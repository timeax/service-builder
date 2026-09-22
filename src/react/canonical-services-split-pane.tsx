// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState, StatusDot } from '@/components/builder/index.tsx';
import { ServiceMetaPopover } from '@/components/service-meta-popover.tsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import type { HandlerService } from '@elqora/dgp-spec';
import { type DragEvent, type ReactNode } from 'react';
import type { CanonicalServiceSummary } from './bottom-panel-model';
import { DRAG_MIME_SERVICE } from './drag-contracts';

type Mode = 'active' | 'all' | 'catalog';
type Tone = 'default' | 'success' | 'warning' | 'danger';

function status(
    service: CanonicalServiceSummary,
    handler: HandlerService | undefined,
    rateMismatch: boolean,
    mode: Mode,
    strictSafety: boolean,
): { tone: Tone; label: string } {
    if (handler && handler.state !== 'enabled') return { tone: 'danger', label: handler.state };
    if (mode === 'active') return { tone: 'success', label: 'Attached' };
    if (!strictSafety && (rateMismatch || service.matchesSelectedFilter === false)) return { tone: 'warning', label: 'Usable' };
    if (rateMismatch) return { tone: 'danger', label: 'Hidden by context' };
    if (service.matchesSelectedFilter === false) return { tone: 'warning', label: 'Outside filter' };
    if (service.attachmentCount) return { tone: 'success', label: 'Attached' };
    if (service.matchesSelectedFilter === true) return { tone: 'success', label: 'Eligible' };
    return { tone: 'default', label: 'Available' };
}

function mismatchReasons(service: CanonicalServiceSummary, handler: HandlerService | undefined, rateMismatch: boolean, mode: Mode): string[] {
    if (mode === 'active') return [];
    return [
        handler && handler.state !== 'enabled' ? 'Service unavailable' : null,
        handler?.state === 'enabled' && service.matchesSelectedFilter === false ? 'Capability mismatch' : null,
        rateMismatch ? 'Rate policy mismatch' : null,
    ].filter((reason): reason is string => reason !== null);
}

function badgeClass(tone: Tone) {
    return cn(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
        tone === 'warning' && 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
        tone === 'danger' && 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
        tone === 'default' && 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300',
    );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-950">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase dark:text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
    );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
    );
}

export function CanonicalServicesSplitPane({
    mode,
    rows,
    selectedId,
    onSelect,
    services,
    canEdit,
    rateMismatchIds,
    strictSafety,
    contextFilterLabel,
    selectedTriggerCount,
    usedServiceCount,
    leftHeader,
    onNodeClick,
    onOpenFallbackQuickAdd,
    onOpenFallbackEditor,
}: {
    mode: Mode;
    rows: readonly CanonicalServiceSummary[];
    selectedId: string | null;
    onSelect(id: string): void;
    services: readonly HandlerService[];
    canEdit: boolean;
    rateMismatchIds: ReadonlySet<string> | null;
    strictSafety: boolean;
    contextFilterLabel?: string;
    selectedTriggerCount: number;
    usedServiceCount: number;
    leftHeader?: ReactNode;
    onNodeClick(id: string): void;
    onOpenFallbackQuickAdd(service: CanonicalServiceSummary): void;
    onOpenFallbackEditor(service: CanonicalServiceSummary): void;
}) {
    const selected = rows.find((service) => String(service.id) === selectedId) ?? null;
    const handler = selected ? services.find((service) => String(service.id) === String(selected.id)) : undefined;
    const selectedRateMismatch = selected ? rateMismatchIds?.has(String(selected.id)) === true : false;
    const selectedStatus = selected ? status(selected, handler, selectedRateMismatch, mode, strictSafety) : null;
    const selectedReasons = selected ? mismatchReasons(selected, handler, selectedRateMismatch, mode) : [];
    const dragService = (service: CanonicalServiceSummary, event: DragEvent<HTMLButtonElement>) => {
        if (!canEdit || mode === 'active') {
            event.preventDefault();
            return;
        }
        event.dataTransfer.setData(DRAG_MIME_SERVICE, String(service.id));
        event.dataTransfer.effectAllowed = 'copy';
    };
    const emptyTitle = mode === 'active' ? 'No active services yet' : 'No services match this view';
    const emptyDescription =
        mode === 'active'
            ? 'Connect a service to a tag, field, or option and it will appear here with its bindings.'
            : mode === 'catalog'
              ? 'Select a catalog group or create one to organize source services for faster assignment.'
              : 'Try changing the search or toggles to bring more services into view.';
    return (
        <div data-testid="service-split-pane" className="min-h-90 p-4">
            <ResizablePanelGroup direction="horizontal" className="min-h-90">
                <ResizablePanel defaultSize={44} minSize={30}>
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="space-y-3 border-b border-slate-100 pr-4 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-3">
                                <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                                    {mode === 'active' ? 'Attached services' : mode === 'catalog' ? 'Catalog workspace' : 'All services'}
                                </h4>
                                <div className="flex items-center gap-2">
                                    {mode === 'catalog' ? (
                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-blue-700 uppercase dark:bg-blue-500/10 dark:text-blue-200">
                                            {contextFilterLabel ?? 'Ungrouped'}
                                        </span>
                                    ) : null}
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:bg-slate-900 dark:text-slate-300">
                                        {rows.length}
                                    </span>
                                </div>
                            </div>
                            {mode === 'all' && contextFilterLabel ? (
                                <div className="flex flex-wrap gap-2 pb-3">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        Context tag: {contextFilterLabel}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        {selectedTriggerCount} selected trigger{selectedTriggerCount === 1 ? '' : 's'}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        {usedServiceCount} active service{usedServiceCount === 1 ? '' : 's'} in context
                                    </span>
                                </div>
                            ) : null}
                            {leftHeader ? <div className="space-y-3 pb-3">{leftHeader}</div> : null}
                        </div>
                        <ScrollArea className="h-[calc(var(--bottom-panel-height)-14.5rem)] max-h-[calc(var(--bottom-panel-height)-14.5rem)] min-h-0 flex-1">
                            <div className="space-y-2 p-3 pl-0">
                                {rows.length ? (
                                    rows.map((service) => {
                                        const serviceId = String(service.id);
                                        const serviceHandler = services.find((item) => String(item.id) === serviceId);
                                        const rateMismatch = rateMismatchIds?.has(serviceId) === true;
                                        const state = status(service, serviceHandler, rateMismatch, mode, strictSafety);
                                        const reasons = mismatchReasons(service, serviceHandler, rateMismatch, mode);
                                        return (
                                            <button
                                                key={String(service.id)}
                                                type="button"
                                                draggable={canEdit && mode !== 'active'}
                                                onClick={() => onSelect(String(service.id))}
                                                onDragStart={(event) => dragService(service, event)}
                                                className={cn(
                                                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                                                    selectedId === String(service.id)
                                                        ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700',
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <StatusDot tone={state.tone} />
                                                            <span
                                                                title={service.name}
                                                                className="max-w-full truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                                                            >
                                                                {service.name}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                            <span>#{String(service.id)}</span>
                                                            {service.category ? <span>{service.category}</span> : null}
                                                            {service.platformId ? <span>{service.platformId}</span> : null}
                                                        </div>
                                                    </div>
                                                    <span className={badgeClass(state.tone)}>{state.label}</span>
                                                </div>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                        {service.attachmentCount} node{service.attachmentCount === 1 ? '' : 's'}
                                                    </span>
                                                    {service.rate !== undefined ? (
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                            Rate {service.rate}
                                                        </span>
                                                    ) : null}
                                                    {reasons.slice(0, 2).map((reason) => (
                                                        <span
                                                            key={reason}
                                                            className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                                                        >
                                                            {reason}
                                                        </span>
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <EmptyState title={emptyTitle} description={emptyDescription} />
                                )}
                            </div>
                        </ScrollArea>
                    </section>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={56} minSize={36}>
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="border-b border-slate-100 px-4 dark:border-slate-800">
                            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">Service detail</p>
                            <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                                {selected ? selected.name : 'Select a service'}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {mode === 'active'
                                    ? 'Highlight connected nodes, inspect usage, and jump back into the canvas.'
                                    : mode === 'catalog'
                                      ? 'Inspect compatibility, rates, and bindings while browsing manual catalog groups.'
                                      : 'Inspect compatibility, rates, and bindings before assigning the service to a node.'}
                            </p>
                        </div>
                        <ScrollArea className="h-[calc(var(--bottom-panel-height)-14.5rem)] max-h-[calc(var(--bottom-panel-height)-14.5rem)] min-h-0 flex-1">
                            <div className="p-5">
                                {selected ? (
                                    <div className="space-y-5">
                                        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <StatusDot tone={selectedStatus?.tone} className="mt-0.5" />
                                                        <span>#{String(selected.id)}</span>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                        {selected.category ? <span>{selected.category}</span> : null}
                                                        {selected.platformId ? <span>{selected.platformId}</span> : null}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ServiceMetaPopover meta={handler?.meta} />
                                                    {mode === 'active' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={!canEdit}
                                                                title={!canEdit ? 'You do not have permission to edit this definition.' : undefined}
                                                                onClick={() => onOpenFallbackQuickAdd(selected)}
                                                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                                            >
                                                                Add fallbacks
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={!canEdit}
                                                                title={!canEdit ? 'You do not have permission to edit this definition.' : undefined}
                                                                onClick={() => onOpenFallbackEditor(selected)}
                                                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                                            >
                                                                Open fallback editor
                                                            </button>
                                                        </>
                                                    ) : null}
                                                    <span className={badgeClass(selectedStatus?.tone ?? 'default')}>{selectedStatus?.label}</span>
                                                </div>
                                            </div>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                <DetailMetric label="Rate" value={selected.rate === undefined ? 'Not set' : String(selected.rate)} />
                                                <DetailMetric label="State" value={handler?.state ?? 'Unknown'} />
                                                <DetailMetric label="Min" value={String(selected.min)} />
                                                <DetailMetric label="Max" value={String(selected.max)} />
                                            </div>
                                        </div>
                                        {mode !== 'active' ? (
                                            <section className="space-y-3">
                                                <SectionTitle
                                                    title="Context fit"
                                                    description="This summary shows how the service fits the selected filter and advisory rate context."
                                                />
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                                                    <div className="flex flex-wrap gap-2">
                                                        <span
                                                            className={badgeClass(
                                                                selected.matchesSelectedFilter === false
                                                                    ? 'warning'
                                                                    : selected.matchesSelectedFilter === true
                                                                      ? 'success'
                                                                      : 'default',
                                                            )}
                                                        >
                                                            {selected.matchesSelectedFilter === null
                                                                ? 'No filter selected'
                                                                : selected.matchesSelectedFilter
                                                                  ? 'Selected-filter fit'
                                                                  : 'Outside selected filter'}
                                                        </span>
                                                        <span
                                                            className={badgeClass(
                                                                rateMismatchIds === null ? 'default' : selectedRateMismatch ? 'warning' : 'success',
                                                            )}
                                                        >
                                                            {rateMismatchIds === null
                                                                ? 'Rate not checked'
                                                                : selectedRateMismatch
                                                                  ? 'Rate blocked'
                                                                  : 'Rate compatible'}
                                                        </span>
                                                    </div>
                                                    {selectedReasons.length ? (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {selectedReasons.map((reason) => (
                                                                <span
                                                                    key={reason}
                                                                    className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                                                                >
                                                                    {reason}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                                            {selected.matchesSelectedFilter === null && rateMismatchIds === null
                                                                ? 'Select a filter or primary rate to inspect compatibility.'
                                                                : 'No capability or rate mismatch was found in the checked context.'}
                                                        </p>
                                                    )}
                                                </div>
                                            </section>
                                        ) : null}
                                        <section className="space-y-3">
                                            <SectionTitle title="Capabilities" description="Enabled handler-service capabilities and metadata." />
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                                                {selected.enabledCapabilityIds.length || Object.keys(handler?.meta ?? {}).length ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {selected.enabledCapabilityIds.map((id) => (
                                                            <span
                                                                key={id}
                                                                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                                                            >
                                                                {id}
                                                            </span>
                                                        ))}
                                                        {Object.keys(handler?.meta ?? {})
                                                            .slice(0, 3)
                                                            .map((key) => (
                                                                <span
                                                                    key={key}
                                                                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                                                >
                                                                    {key}
                                                                </span>
                                                            ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        No enabled capabilities were published for this service.
                                                    </p>
                                                )}
                                            </div>
                                        </section>
                                        <section className="space-y-3">
                                            <SectionTitle
                                                title="Bindings"
                                                description="Nodes currently connected to this service. Click any node to jump back into the canvas."
                                            />
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                                                {selected.attachedNodeIds.length ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {selected.attachedNodeIds.map((id, index) => (
                                                            <button
                                                                key={id}
                                                                type="button"
                                                                onClick={() => onNodeClick(id)}
                                                                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                            >
                                                                {selected.attachedNodeLabels[index] ?? id}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        This service is not attached to any node yet. Drag it from the catalog onto a node to assign
                                                        it.
                                                    </p>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                ) : (
                                    <EmptyState
                                        title="No service selected"
                                        description={
                                            mode === 'active'
                                                ? 'Choose a connected service from the list to see its bindings.'
                                                : mode === 'catalog'
                                                  ? 'Pick a service from the selected catalog group to inspect its current visible-group fit.'
                                                  : 'Pick a service to inspect how it fits the current visible-group context.'
                                        }
                                    />
                                )}
                            </div>
                        </ScrollArea>
                    </section>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
