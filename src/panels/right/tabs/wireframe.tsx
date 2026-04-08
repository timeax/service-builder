import { useNodeContextMenu } from '@/builder/node-context-menu.tsx';
import { getCurrentTag, getVisiblePreviewFields } from '@/builder/view-models.tsx';
import { EmptyState } from '@/components/builder';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import WireframeTagsWidget, { type TagNotice } from '@/panels/right/components/wireframe-tags-widget.tsx';
import type { Field, Tag } from '@timeax/digital-service-engine';
import { useOrderFlow, Wrapper } from '@timeax/digital-service-engine/react';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { WorkspaceBootInlineNotice } from '@/workspace/boot-status.tsx';
import { BsChevronDown } from 'react-icons/bs';

const CHECKBOX_SINGLE_EXTRA_PROPS = Object.freeze({ single: true });

function formatMetricNumber(value: unknown): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value);
}

type FooterDetailKind = 'services' | 'pricing' | 'utility_lines';

type FooterSummaryItem = {
    label: string;
    value: string;
    detailsKind?: FooterDetailKind;
};

export function Wireframe() {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const { openNodeContextMenu, canAcceptDropPayload, handleNodeDrop } = useNodeContextMenu();
    const currentTag = getCurrentTag(canvas);
    const previewFields = useMemo(() => getVisiblePreviewFields(canvas, currentTag?.id), [canvas.props, canvas.selectionInfo, canvas.activeId]);
    const selectedOptionsCount = canvas.selectionInfo.optionIds.length;
    const flow = useOrderFlow();
    const [isFooterOpen, setIsFooterOpen] = useState(true);

    const footerSummary = useMemo<FooterSummaryItem[]>(() => {
        const minText = formatMetricNumber(flow.min);
        const maxText = formatMetricNumber(flow.max);
        const rangeText = minText === '--' && maxText === '--' ? '--' : `${minText} - ${maxText}`;

        return [
            { label: 'Tag', value: currentTag?.raw.label ?? 'No active tag' },
            { label: 'Visible fields', value: String(previewFields.length) },
            { label: 'Selected options', value: String(selectedOptionsCount) },
            { label: 'Quantity', value: formatMetricNumber(flow.quantityPreview) },
            { label: 'Min/Max', value: rangeText },
            { label: 'Services', value: String(flow.services.length), detailsKind: 'services' },
            { label: 'Base', value: formatMetricNumber(flow.pricingPreview?.base), detailsKind: 'pricing' },
            { label: 'Utilities', value: formatMetricNumber(flow.pricingPreview?.utilities), detailsKind: 'pricing' },
            { label: 'Total', value: formatMetricNumber(flow.pricingPreview?.total), detailsKind: 'pricing' },
            { label: 'Utility lines', value: String(flow.pricingPreview?.utilityBreakdown?.length ?? 0), detailsKind: 'utility_lines' },
        ];
    }, [
        currentTag?.raw.label,
        flow.max,
        flow.min,
        flow.pricingPreview?.base,
        flow.pricingPreview?.total,
        flow.pricingPreview?.utilities,
        flow.pricingPreview?.utilityBreakdown?.length,
        flow.quantityPreview,
        flow.services.length,
        previewFields.length,
        selectedOptionsCount,
    ]);

    const serviceDetails = useMemo(() => {
        const servicesMap = (ws.services.data ?? {}) as Record<string, { id?: string | number; name?: string; rate?: number; min?: number; max?: number }>;
        return flow.services.map((serviceId) => {
            const service = servicesMap[String(serviceId)];
            return {
                id: serviceId,
                name: service?.name ?? `Service ${String(serviceId)}`,
                rate: service?.rate,
                min: service?.min,
                max: service?.max,
            };
        });
    }, [flow.services, ws.services.data]);

    const renderPillDetails = useCallback(
        (kind: FooterDetailKind): ReactNode => {
            if (kind === 'services') {
                return (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Visible Services</p>
                        {serviceDetails.length ? (
                            <div className="max-h-56 space-y-2 overflow-auto pr-1">
                                {serviceDetails.map((service) => (
                                    <div key={String(service.id)} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                                        <p className="font-medium text-slate-700 dark:text-slate-200">{service.name}</p>
                                        <p className="text-slate-500 dark:text-slate-400">ID: {String(service.id)}</p>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Rate: {formatMetricNumber(service.rate)} · Min/Max: {formatMetricNumber(service.min)} - {formatMetricNumber(service.max)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No services are currently active for this selection.</p>
                        )}
                    </div>
                );
            }

            if (kind === 'utility_lines') {
                const lines = flow.pricingPreview?.utilityBreakdown ?? [];
                return (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Utility Breakdown</p>
                        {lines.length ? (
                            <div className="max-h-56 space-y-2 overflow-auto pr-1">
                                {lines.map((line, index) => (
                                    <div key={`${line.nodeId}:${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                                        <p className="font-medium text-slate-700 dark:text-slate-200">Node: {line.nodeId}</p>
                                        <p className="text-slate-500 dark:text-slate-400">Mode: {line.mode}</p>
                                        <p className="text-slate-500 dark:text-slate-400">Amount: {formatMetricNumber(line.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No utility line items in the current preview.</p>
                        )}
                    </div>
                );
            }

            return (
                <div className="space-y-1 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Pricing Summary</p>
                    <p className="text-slate-500 dark:text-slate-400">Base: {formatMetricNumber(flow.pricingPreview?.base)}</p>
                    <p className="text-slate-500 dark:text-slate-400">Utilities: {formatMetricNumber(flow.pricingPreview?.utilities)}</p>
                    <p className="text-slate-500 dark:text-slate-400">Total: {formatMetricNumber(flow.pricingPreview?.total)}</p>
                </div>
            );
        },
        [flow.pricingPreview?.base, flow.pricingPreview?.total, flow.pricingPreview?.utilities, flow.pricingPreview?.utilityBreakdown, serviceDetails],
    );
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

                        <div className="border-t border-slate-200 pt-3 flex flex-col gap-2 dark:border-slate-800">
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
                                                    extraProps={field.type === 'checkbox' && !field.options ? CHECKBOX_SINGLE_EXTRA_PROPS : undefined}
                                                    field={field}
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

            <div className="mt-auto border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-slate-100/70 dark:hover:bg-slate-900/80"
                    onClick={() => setIsFooterOpen((prev) => !prev)}
                    aria-expanded={isFooterOpen}
                    aria-controls="wireframe-footer-summary"
                >
                    <span className="font-medium">Order preview summary</span>
                    <BsChevronDown className={`transition-transform ${isFooterOpen ? 'rotate-180' : 'rotate-0'}`} />
                </button>
                {isFooterOpen ? (
                    <div id="wireframe-footer-summary" className="mt-2 flex flex-wrap gap-2">
                        {footerSummary.map((item) => {
                            const chip = (
                                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                                    <span className="text-slate-500 dark:text-slate-400">{item.label}:</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.value}</span>
                                </span>
                            );

                            if (!item.detailsKind) return <div key={item.label}>{chip}</div>;

                            return (
                                <Popover key={item.label}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="rounded-md transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                                            aria-label={`${item.label} details`}
                                        >
                                            {chip}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" side="top" sideOffset={8} collisionPadding={12} className="w-80 rounded-xl p-3">
                                        {renderPillDetails(item.detailsKind)}
                                    </PopoverContent>
                                </Popover>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default Wireframe;

