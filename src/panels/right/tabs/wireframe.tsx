import { useNodeContextMenu } from '@/builder/node-context-menu.tsx';
import { getCurrentTag, getVisiblePreviewFields } from '@/builder/view-models.tsx';
import { EmptyState } from '@/components/builder';
import WireframeTagsWidget, { type TagNotice } from '@/panels/right/components/wireframe-tags-widget.tsx';
import type { Field, Tag } from '@timeax/digital-service-engine';
import { useOrderFlow, Wrapper } from '@timeax/digital-service-engine/react';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useCallback, useMemo } from 'react';
import { WorkspaceBootInlineNotice } from '@/workspace/boot-status.tsx';

export function Wireframe() {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const { openNodeContextMenu, canAcceptDropPayload, handleNodeDrop } = useNodeContextMenu();
    const currentTag = getCurrentTag(canvas);
    const previewFields = useMemo(() => getVisiblePreviewFields(canvas, currentTag?.id), [canvas.props, canvas.selectionInfo, canvas.activeId]);
    const selectedOptionsCount = canvas.selectionInfo.optionIds.length;
    const flow = useOrderFlow();

    const footerLine = currentTag
        ? `Tag: ${currentTag.raw.label} · Visible fields: ${previewFields.length} · Selected options: ${selectedOptionsCount}`
        : `No active tag · Visible fields: 0 · Selected options: ${selectedOptionsCount}`;

    const { visibleTag, parents, children, visibleFields } = useMemo(() => {
        const result = canvas.api.selection.visibleGroup();
        const notices = canvas.api.builder.getProps().notices;

        if (result?.kind !== 'single') {
            return {
                visibleTag: null,
                parentId: null,
                parents: [] as Tag[],
                children: [] as Tag[],
                visibleFieldIds: [] as string[],
                visibleFields: [] as Field[],
            };
        }

        const vg = result.group;
        ///---
        const parents = (vg.parentTags ?? []).filter((t) => t.id !== 't:root');
        const children = vg.childrenTags ?? [];
        const visibleFields = vg.fields ?? [];
        const visibleFieldIds = vg.fieldIds ?? [];

        // strict rule: parentId is ONLY from parentTags, otherwise null
        const visibleTag = vg.tag && vg.tagId && vg.tagId !== 't:root' ? vg.tag : null;
        const parentId = vg.parentTags?.length ? vg.parentTags[vg.parentTags.length - 1].id : null;

        return {
            visibleTag,
            parentId,
            parents,
            children,
            visibleFieldIds,
            visibleFields,
            notices,
        };
    }, [canvas.props, canvas.selectionInfo, canvas.activeId, flow.visibleGroup]);

    const noticesByTagId = useMemo(() => {
        const map = new Map<string, TagNotice[]>();
        for (const notice of visibleFields.length || children.length || parents.length || visibleTag
            ? (canvas.api.builder.getProps().notices ?? [])
            : (canvas.api.builder.getProps().notices ?? [])) {
            if (notice?.kind !== 'label') continue;
            if (notice?.target?.scope !== 'node') continue;
            if (notice?.target?.node_kind !== 'tag') continue;

            const nodeId = notice.target.node_id;
            const item: TagNotice = {
                id: notice.id,
                title: notice.title,
                severity: notice.severity,
                color: notice.color,
            };
            const existing = map.get(nodeId) ?? [];
            existing.push(item);
            map.set(nodeId, existing);
        }
        return map;
    }, [canvas.props, canvas.selectionInfo, canvas.activeId]);

    const select = useCallback(
        (id: string) => {
            canvas.setActive(id);
            canvas.api.select([id]);
        },
        [canvas.api, canvas.setActive],
    );

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="mx-auto max-w-md">
                    <div className="flex flex-col gap-4">
                        <WorkspaceBootInlineNotice boot={ws.boot} sections={['snapshotBody', 'policies']} />
                        <WireframeTagsWidget
                            visibleTag={visibleTag}
                            parents={parents}
                            children={children}
                            noticesByTagId={noticesByTagId}
                            onSelect={select}
                            onTagContextMenu={({ id, event }) => {
                                event.preventDefault();
                                openNodeContextMenu({
                                    nodeId: id,
                                    nodeKind: 'tag',
                                    surface: 'wireframe',
                                    clientX: event.clientX,
                                    clientY: event.clientY,
                                });
                            }}
                            onTagDragOver={({ event }) => {
                                if (!canAcceptDropPayload(event.dataTransfer)) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'copy';
                            }}
                            onTagDrop={({ id, event }) => {
                                if (!canAcceptDropPayload(event.dataTransfer)) return;
                                event.preventDefault();
                                handleNodeDrop({
                                    receiverId: id,
                                    receiverKind: 'tag',
                                    surface: 'wireframe',
                                    clientX: event.clientX,
                                    clientY: event.clientY,
                                    dataTransfer: event.dataTransfer,
                                });
                            }}
                        />

                        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                            {visibleFields.length ? (
                                visibleFields.map((field) => {
                                    return (
                                        <div onClick={() => select(field.id)} className="cursor-pointer pb-2" key={field.id}>
                                            <div
                                                onContextMenu={(event) => {
                                                    event.preventDefault();
                                                    openNodeContextMenu({
                                                        nodeId: field.id,
                                                        nodeKind: 'field',
                                                        surface: 'wireframe',
                                                        clientX: event.clientX,
                                                        clientY: event.clientY,
                                                    });
                                                }}
                                                onDragOver={(event) => {
                                                    if (!canAcceptDropPayload(event.dataTransfer)) return;
                                                    event.preventDefault();
                                                    event.dataTransfer.dropEffect = 'copy';
                                                }}
                                                onDrop={(event) => {
                                                    if (!canAcceptDropPayload(event.dataTransfer)) return;
                                                    event.preventDefault();
                                                    handleNodeDrop({
                                                        receiverId: field.id,
                                                        receiverKind: 'field',
                                                        surface: 'wireframe',
                                                        clientX: event.clientX,
                                                        clientY: event.clientY,
                                                        dataTransfer: event.dataTransfer,
                                                    });
                                                }}
                                            >
                                                <Wrapper
                                                    extraProps={{ ...(field.type == 'checkbox' && !field.options ? { single: true } : {}) }}
                                                    field={field}
                                                    key={field.id}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <EmptyState
                                    title="Wireframe stub"
                                    description="Wireframe visible fields body is empty. Implement your custom preview content here."
                                    className="min-h-55"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <p className="truncate">{footerLine}</p>
            </div>
        </div>
    );
}

export default Wireframe;
