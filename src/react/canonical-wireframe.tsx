// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState } from '@/components/builder';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import WireframeTagsWidget, { type TagNotice } from '@/panels/right/components/wireframe-tags-widget.tsx';
import { buildOrderSnapshot, createOrderingSession, type BuildOrderSnapshotResult, type OrderingSession } from '@elqora/dgp-ordering';
import { FormPaletteOrderingProvider, OrderingInput } from '@elqora/dgp-ordering-form-palette';
import type { HandlerService, ProductDefinition } from '@elqora/dgp-spec';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BsChevronDown } from 'react-icons/bs';
import { CanonicalWorkspaceBootInlineNotice } from './canonical-boot-status';
import { canonicalInputRegistry } from './canonical-input-registry';
import { useOptionalCanonicalNodeContextMenu } from './canonical-node-context-menu';
import { useServiceBuilderCanvasModel } from './presentation';
import { useWorkspaceSelector } from './workspace';

function formatMetricNumber(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value) : '--';
}

type FooterDetailKind = 'services' | 'pricing' | 'utility_lines';
type FooterSummaryItem = { label: string; value: string; detailsKind?: FooterDetailKind };

function formatPreviewFailure(result: BuildOrderSnapshotResult): string | null {
    if (!('kind' in result)) return null;
    if (result.kind === 'host_configuration') return result.failure.message;
    return `${result.issues.length} customer input issue${result.issues.length === 1 ? '' : 's'} in this preview.`;
}

function CanonicalWireframeBody({
    definition,
    services,
    session,
}: {
    definition: ProductDefinition;
    services: readonly HandlerService[];
    session: OrderingSession;
}) {
    const canvas = useServiceBuilderCanvasModel();
    const contextMenu = useOptionalCanonicalNodeContextMenu();
    const [orderingState, setOrderingState] = useState(() => session.store.get());
    const [isFooterOpen, setIsFooterOpen] = useState(true);
    useEffect(() => {
        setOrderingState(session.store.get());
        return session.store.subscribe(setOrderingState);
    }, [session]);
    const context = session.get_context();
    const currentFilter = context?.filter.filter ?? definition.filters.find((filter) => filter.id === session.get_filter_id()) ?? null;
    const parents = context?.filter.lineage.filter((filter) => filter.id !== currentFilter?.id) ?? [];
    const children = currentFilter
        ? definition.filters.filter((filter) => filter.bind_id === currentFilter.id)
        : definition.filters.filter((filter) => !filter.bind_id);
    const visibleIds = new Set(context?.visibility.fieldIds ?? []);
    const visibleFields = definition.fields.filter((field) => visibleIds.has(field.id));
    const selectedOptionsCount = Object.values(orderingState.selections).reduce((sum, ids) => sum + ids.length, 0);
    const snapshotResult = useMemo(
        () =>
            buildOrderSnapshot({
                definition,
                filter_id: session.get_filter_id(),
                trigger_ids: session.get_trigger_ids(),
                state: orderingState,
                services,
                mode: 'dev',
            }),
        [definition, orderingState, services, session],
    );
    const snapshot = snapshotResult.ok ? snapshotResult.snapshot : undefined;
    const serviceById = useMemo(() => new Map(services.map((service) => [String(service.id), service])), [services]);
    const base = snapshot?.service_ids.reduce<number>((sum, id) => sum + (serviceById.get(String(id))?.rate ?? 0), 0);
    const utilities = snapshot?.utilities.reduce((sum, utility) => sum + utility.advisory_amount, 0);
    const footerSummary: FooterSummaryItem[] = [
        { label: 'Tag', value: currentFilter?.label ?? 'No active tag' },
        { label: 'Visible fields', value: String(visibleFields.length) },
        { label: 'Selected options', value: String(selectedOptionsCount) },
        { label: 'Quantity', value: formatMetricNumber(snapshot?.quantity) },
        { label: 'Min/Max', value: snapshot ? `${formatMetricNumber(snapshot.min)} - ${formatMetricNumber(snapshot.max)}` : '--' },
        { label: 'Services', value: String(snapshot?.service_ids.length ?? 0), detailsKind: 'services' },
        { label: 'Base', value: formatMetricNumber(base), detailsKind: 'pricing' },
        { label: 'Utilities', value: formatMetricNumber(utilities), detailsKind: 'pricing' },
        { label: 'Total', value: formatMetricNumber(base === undefined ? undefined : base + (utilities ?? 0)), detailsKind: 'pricing' },
        { label: 'Utility lines', value: String(snapshot?.utilities.length ?? 0), detailsKind: 'utility_lines' },
    ];
    const previewFailure = formatPreviewFailure(snapshotResult);
    const noticesByTagId = useMemo(() => {
        const map = new Map<string, TagNotice[]>();
        for (const notice of definition.notices) {
            if (notice.kind !== 'label' || notice.target.scope !== 'node' || notice.target.node_kind !== 'tag') continue;
            const items = map.get(notice.target.node_id) ?? [];
            items.push({
                id: notice.id,
                title: notice.title,
                severity: notice.severity,
                color: typeof notice.meta?.color === 'string' ? notice.meta.color : undefined,
            });
            map.set(notice.target.node_id, items);
        }
        return map;
    }, [definition.notices]);
    const select = useCallback(
        (id: string) => {
            if (definition.filters.some((filter) => filter.id === id)) session.set_filter_id(id);
            canvas.api?.select([id], id);
        },
        [canvas.api, definition.filters, session],
    );
    const renderDetails = (kind: FooterDetailKind): ReactNode => {
        if (kind === 'services')
            return (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Visible Services</p>
                    {snapshot?.service_ids.length ? (
                        snapshot.service_ids.map((id) => {
                            const service = serviceById.get(String(id));
                            return (
                                <div
                                    key={String(id)}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{service?.name ?? `Service ${String(id)}`}</p>
                                    <p className="text-slate-500 dark:text-slate-400">ID: {String(id)}</p>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Rate: {formatMetricNumber(service?.rate)} · Min/Max: {formatMetricNumber(service?.min)} -{' '}
                                        {formatMetricNumber(service?.max)}
                                    </p>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No services are currently active for this selection.</p>
                    )}
                </div>
            );
        if (kind === 'utility_lines')
            return (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Utility Breakdown</p>
                    {snapshot?.utilities.length ? (
                        snapshot.utilities.map((line, index) => (
                            <div
                                key={`${line.node_id}:${index}`}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                            >
                                <p className="font-medium text-slate-700 dark:text-slate-200">Node: {line.node_id}</p>
                                <p className="text-slate-500 dark:text-slate-400">Mode: {line.mode}</p>
                                <p className="text-slate-500 dark:text-slate-400">Amount: {formatMetricNumber(line.advisory_amount)}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">No utility line items in the current preview.</p>
                    )}
                </div>
            );
        return (
            <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Pricing Summary</p>
                <p className="text-slate-500 dark:text-slate-400">Base: {formatMetricNumber(base)}</p>
                <p className="text-slate-500 dark:text-slate-400">Utilities: {formatMetricNumber(utilities)}</p>
                <p className="text-slate-500 dark:text-slate-400">
                    Total: {formatMetricNumber(base === undefined ? undefined : base + (utilities ?? 0))}
                </p>
            </div>
        );
    };

    return (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
            <ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block [&>div]:w-full">
                <div className="w-full min-w-0 p-4">
                    <div className="mx-auto max-w-md">
                        <div className="flex flex-col gap-4">
                            <CanonicalWorkspaceBootInlineNotice sections={['snapshot', 'policies']} />
                            <WireframeTagsWidget
                                visibleTag={currentFilter}
                                parents={parents}
                                children={children}
                                noticesByTagId={noticesByTagId}
                                onSelect={select}
                            />
                            <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                                {visibleFields.length ? (
                                    visibleFields.map((field) => (
                                        <div
                                            onDoubleClick={() => select(field.id)}
                                            onContextMenu={(event) => {
                                                if (!contextMenu) return;
                                                event.preventDefault();
                                                contextMenu.open_node_menu({ node_id: field.id, node_kind: 'field', client_x: event.clientX, client_y: event.clientY, surface: 'wireframe' });
                                            }}
                                            className="cursor-pointer pb-2"
                                            key={field.id}
                                        >
                                            <OrderingInput
                                                field={field}
                                                extra_props={field.type === 'checkbox' && !field.options ? { single: true } : undefined}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <EmptyState
                                        title="Wireframe stub"
                                        description="Wireframe visible fields body is empty. Implement your custom preview content here."
                                        className="min-h-55"
                                    />
                                )}
                            </div>
                            {previewFailure ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                                    {previewFailure}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <div className="mt-auto border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-slate-100/70 dark:hover:bg-slate-900/80"
                    onClick={() => setIsFooterOpen((open) => !open)}
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
                            return item.detailsKind ? (
                                <Popover key={item.label}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="rounded-md transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:outline-none"
                                            aria-label={`${item.label} details`}
                                        >
                                            {chip}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" side="top" sideOffset={8} collisionPadding={12} className="w-80 rounded-xl p-3">
                                        {renderDetails(item.detailsKind)}
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <div key={item.label}>{chip}</div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function CanonicalWireframe() {
    const canvas = useServiceBuilderCanvasModel();
    const services = useWorkspaceSelector((state) => state.services);
    const definition = canvas.definition;
    const filterId = canvas.context_filter_id ?? definition?.filters[0]?.id;
    const session = useMemo(
        () => (definition && filterId ? createOrderingSession(definition, filterId, undefined, canonicalInputRegistry, { mode: 'dev' }) : undefined),
        [definition, filterId],
    );
    if (!definition || !session)
        return (
            <div className="p-4">
                <EmptyState
                    title="Wireframe stub"
                    description="Wireframe visible fields body is empty. Implement your custom preview content here."
                    className="min-h-55"
                />
            </div>
        );
    return (
        <FormPaletteOrderingProvider session={session} definition={definition} registry={canonicalInputRegistry}>
            <CanonicalWireframeBody definition={definition} services={services} session={session} />
        </FormPaletteOrderingProvider>
    );
}
