import type { BuilderNodeViewModel } from '@/components/builder/index.tsx';
import { countOptions, filterFieldOptionsById } from '@/builder/option-helpers.ts';
import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';
import type { CommentThread, DgpServiceCapability, Field, FieldOption, Tag } from '@timeax/digital-service-engine/schema';
import type { UseCanvasReturn, WorkspaceAPI } from '@timeax/digital-service-engine/workspace';
import { BsChatSquareQuote } from 'react-icons/bs';
import { LuTags } from 'react-icons/lu';
import { MdOutlineRadioButtonChecked } from 'react-icons/md';
import { RxInput } from 'react-icons/rx';

export type CanvasNodeVM = BuilderNodeViewModel & {
    x: number;
    y: number;
    width?: number;
    threadCount?: number;
};

export type WireframePreviewField = {
    id: string;
    field: Field;
    node: FieldNode;
    options: FieldOption[];
};

export function getNodeIcon(kind: BuilderNodeViewModel['kind']) {
    if (kind === 'tag') return <LuTags />;
    if (kind === 'field') return <RxInput />;
    if (kind === 'option') return <MdOutlineRadioButtonChecked />;
    return <BsChatSquareQuote />;
}

export function toNodeViewModel(args: {
    kind: BuilderNodeViewModel['kind'];
    nodeId: string;
    label: string;
    hint?: string;
    meta?: string;
    active?: boolean;
    selected?: boolean;
}): BuilderNodeViewModel {
    return {
        ...args,
        icon: getNodeIcon(args.kind),
    };
}

export function buildCanvasNodeViewModels(canvas: UseCanvasReturn, threads: readonly CommentThread[] = []): CanvasNodeVM[] {
    const threadCounts = new Map<string, number>();

    for (const thread of threads) {
        if (thread.anchor?.type === 'node') {
            threadCounts.set(thread.anchor.nodeId, (threadCounts.get(thread.anchor.nodeId) ?? 0) + 1);
        }
    }

    return canvas.graph.nodes.map((node, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const threadCount = threadCounts.get(node.id) ?? 0;

        return {
            ...toNodeViewModel({
                nodeId: node.id,
                kind: node.kind as any,
                label: node.label,
                hint: node.bind_type === 'utility' ? 'Utility field' : node.bind_type === 'bound' ? 'Bound to active tag' : undefined,
                meta: node.kind,
                active: canvas.activeId === node.id,
                selected: canvas.selection.includes(node.id),
            }),
            x: 120 + col * 260,
            y: 120 + row * 170,
            width: node.kind === 'tag' || node.kind === 'option' ? 200 : 240,
            threadCount,
        };
    });
}

export function getNodeSummary(node: TagNode | FieldNode | OptionNode) {
    if (node.kind === 'tag') {
        const includes = node.includes.size;
        const excludes = node.excludes.size;
        const descendants = node.getDescendants().length;
        return `${descendants} visible fields, ${includes} include${includes === 1 ? '' : 's'}, ${excludes} exclude${excludes === 1 ? '' : 's'}`;
    }

    if (node.kind === 'field') {
        const optionCount = countOptions(node.raw as any);
        const ownerCount = node.ownerTags().length;
        return `${node.raw.type} field${optionCount ? `, ${optionCount} option${optionCount === 1 ? '' : 's'}` : ''}${ownerCount ? `, ${ownerCount} owner tag${ownerCount === 1 ? '' : 's'}` : ''}`;
    }

    return `Option for ${node.field().raw.label}`;
}

export function getServiceDetails(ws: WorkspaceAPI, serviceId?: number | string): DgpServiceCapability | null {
    if (serviceId === undefined || serviceId === null) return null;
    return (ws.services.data?.[serviceId as any] ?? null) as DgpServiceCapability | null;
}

export function formatEstimate(service?: DgpServiceCapability | null) {
    if (!service?.estimates) return null;
    const parts = [service.estimates.start?.label, service.estimates.speed?.label, service.estimates.average?.label].filter(Boolean);
    return parts.length ? parts.join(' • ') : null;
}

export function getCurrentTag(canvas: UseCanvasReturn): TagNode | undefined {
    return canvas.selector.getTag(canvas.api.selection.currentTag?.() ?? 't:root') ?? canvas.selector.getTag('t:root') ?? undefined;
}

export function getVisiblePreviewFields(canvas: UseCanvasReturn, tagId?: string | null): WireframePreviewField[] {
    if (!canvas.props) return [];

    const resolvedTag = tagId ?? canvas.api.selection.currentTag?.() ?? canvas.layers.tags[0]?.id;
    if (!resolvedTag) return [];

    const optionIds = canvas.selectionInfo.optionIds as string[];
    const visibility =
        typeof (canvas.api.builder as any).resolveVisibility === 'function'
            ? (canvas.api.builder as any).resolveVisibility(String(resolvedTag), optionIds)
            : { fieldIds: canvas.api.builder.visibleFields(String(resolvedTag), optionIds), optionsByFieldId: {} };
    const visibleIds = visibility.fieldIds as string[];
    const optionsByFieldId = (visibility.optionsByFieldId ?? {}) as Record<string, string[]>;

    return visibleIds
        .map((id) => {
            const node = canvas.selector.getField(String(id));
            if (!node) return null;

            const allowedOptions = optionsByFieldId[node.id] ? new Set(optionsByFieldId[node.id]) : null;
            const options = allowedOptions ? (filterFieldOptionsById(node.raw.options, allowedOptions) ?? []) : (node.raw.options ?? []);

            return {
                id,
                field: {
                    ...node.raw,
                    options,
                },
                node,
                options,
            };
        })
        .filter(Boolean) as WireframePreviewField[];
}

export function describeBinding(node: TagNode | FieldNode | OptionNode) {
    if (node.kind === 'tag') {
        return node.parent()?.raw.label ?? 'Root tag';
    }

    if (node.kind === 'field') {
        const owners = node.ownerTags();
        return owners.length ? owners.map((tag) => tag.raw.label).join(', ') : 'Unbound field';
    }

    return node.field().raw.label;
}

export function getNodeConstraints(tag: Tag) {
    return Object.entries(tag.constraints ?? {}).map(([key, value]) => ({
        key,
        value: Boolean(value),
    }));
}

export function optionSupportsMappings(option: FieldOption) {
    return Boolean(option.id);
}
