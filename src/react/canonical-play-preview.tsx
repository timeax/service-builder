// SPDX-License-Identifier: GPL-3.0-only
import { HeadlessResponsiveDialog } from '@/components/ui/headless-responsive-dialog';
import { buildOrderPreview, createOrderingSession } from '@elqora/dgp-ordering';
import { FormPaletteOrderingProvider, OrderingInput } from '@elqora/dgp-ordering-form-palette';
import { ChevronLeft, CircleCheck, CircleX, X } from 'lucide-react';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { canonicalInputRegistry } from './canonical-input-registry';
import { fieldsVisibleInPreview } from './canonical-preview-visibility';
import type { ServiceBuilderPlayPayload } from './contracts';

export function CanonicalPlayPreviewBody({ payload }: { payload: ServiceBuilderPlayPayload }) {
    const { definition } = payload;
    const session = useMemo(
        () => createOrderingSession(definition, definition.filters[0]?.id ?? '', undefined, canonicalInputRegistry, { mode: 'dev' }),
        [definition],
    );
    const subscribe = useCallback((listener: () => void) => session.store.subscribe(listener), [session]);
    const getSnapshot = useCallback(() => session.store.get(), [session]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const services = useMemo(() => payload.services.map((service) => ({ ...service, rate: Number(service.rate) })), [payload.services]);
    const previewResult = useMemo(
        () =>
            buildOrderPreview({
                definition,
                filter_id: session.get_filter_id(),
                trigger_ids: session.get_trigger_ids(),
                state,
                services,
                mode: 'dev',
            }),
        [definition, services, session, state],
    );
    const preview = previewResult.ok ? previewResult.preview : undefined;
    const context = session.get_context();
    const previewVisibility = previewResult.ok ? previewResult.visibility : context?.visibility;
    const filter = context?.filter.filter;
    const lineage = context?.filter.lineage ?? [];
    const children = definition.filters.filter((candidate) => candidate.bind_id === filter?.id);
    const visibleFields = fieldsVisibleInPreview(definition.fields, previewVisibility);
    const priceService = services.find((service) => String(service.id) === String(preview?.service_ids[0]));
    const quantity = preview?.quantity ?? 0;
    const rate = priceService?.rate;
    const amount = typeof rate === 'number' && Number.isFinite(rate) && Number.isFinite(quantity)
        ? ((rate * quantity) / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
    const readyToSubmit = previewResult.ok && previewResult.can_submit;
    const selectedOptionIds = Object.values(state.selections).flat().join(', ') || '—';

    return (
        <FormPaletteOrderingProvider
            session={session}
            definition={definition}
            registry={canonicalInputRegistry}
            template_context={{ preview, preview_result: previewResult }}
        >
            <div className="flex h-full min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="Order tags">
                        <span className="text-muted-foreground shrink-0 text-sm font-medium">Tags:</span>
                        {lineage.length > 1 || children.length > 0 ? (
                            <>
                                {lineage.length > 1 && (
                                    <button
                                        type="button"
                                        className="inline-flex size-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                        aria-label="Back to parent tag"
                                        onClick={() => session.set_filter_id(lineage[lineage.length - 2]!.id)}
                                    >
                                        <ChevronLeft className="size-4" />
                                    </button>
                                )}
                                {lineage.slice(1).map((candidate) => (
                                    <button
                                        key={candidate.id}
                                        type="button"
                                        className={`inline-flex cursor-pointer items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                            candidate.id === filter?.id
                                                ? 'bg-gray-200 font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                        aria-pressed={candidate.id === filter?.id}
                                        onClick={() => session.set_filter_id(candidate.id)}
                                    >
                                        {candidate.label}
                                    </button>
                                ))}
                                {children.map((candidate) => (
                                    <button
                                        key={candidate.id}
                                        type="button"
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 py-1 pr-1.5 pl-2.5 text-xs text-gray-700 transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                        aria-pressed={false}
                                        onClick={() => session.set_filter_id(candidate.id)}
                                    >
                                        {candidate.label}
                                    </button>
                                ))}
                            </>
                        ) : (
                            <span className="text-muted-foreground text-sm">No tags available for this service.</span>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        {visibleFields.map((field) => (
                            <div key={field.id} className="space-y-1">
                                <OrderingInput field={field} />
                            </div>
                        ))}
                        {'failure' in previewResult && <p className="text-destructive text-sm" role="alert">{previewResult.failure.message}</p>}
                    </div>
                </div>
                <div className="bg-background shrink-0 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div className="bg-card-inner rounded-xl border p-3 text-sm" aria-label="Order preview summary">
                        <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Quantity</span>
                            <span>{quantity ? quantity.toLocaleString() : '—'}</span>
                        </div>
                        <div className="mt-1 flex justify-between gap-3">
                            <span className="text-muted-foreground">Amount to pay</span>
                            <span className="font-semibold">{amount}</span>
                        </div>
                        <div className="text-muted-foreground mt-1 flex items-center justify-between gap-3 text-xs">
                            <span>Catalog rate: {rate ?? '—'} per 1,000</span>
                            <span
                                role="status"
                                aria-label={readyToSubmit ? 'Ready to submit' : 'Not ready to submit'}
                                title={readyToSubmit ? 'Ready to submit' : 'Not ready to submit'}
                                className="shrink-0"
                            >
                                {readyToSubmit ? (
                                    <CircleCheck aria-hidden="true" className="size-5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <CircleX aria-hidden="true" className="text-destructive size-5" />
                                )}
                            </span>
                        </div>
                        <details className="mt-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
                            <summary className="text-muted-foreground cursor-pointer">Preview details</summary>
                            <div className="mt-2 space-y-1">
                                <div>Tag: {filter?.label ?? 'None'}</div>
                                <div>Min: {preview?.min ?? '—'} Max: {preview?.max ?? '—'}</div>
                                <div>Services: {preview?.service_ids.join(', ') ?? '—'}</div>
                                <div>Selected options: {selectedOptionIds}</div>
                            </div>
                        </details>
                    </div>
                    <p className="text-muted-foreground mt-3 text-center text-sm">
                        Preview only. Orders cannot be submitted from this lab.
                    </p>
                </div>
            </div>
        </FormPaletteOrderingProvider>
    );
}

export function CanonicalPlayPreview({
    payload,
    onOpenChange,
}: {
    payload: ServiceBuilderPlayPayload | null;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <HeadlessResponsiveDialog
            open={payload !== null}
            onOpenChange={onOpenChange}
            title="Preview Order"
            description="Preview the customer order form for this branch."
            drawerAt={10000}
            drawerSide="right"
            drawerSize="w-[440px]"
            className="max-w-full [&>[data-drawer-grab]]:hidden [&>div:last-child]:overflow-hidden [&>div:last-child]:p-0"
            maxVh={100}
            headless
        >
            {payload && (
                <>
                    <div className="relative shrink-0 border-b px-4 py-3 pr-12">
                        <h2 className="text-base leading-none font-semibold">Preview Order</h2>
                        <p className="text-muted-foreground mt-1 text-sm">Preview the customer order form for this branch.</p>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => onOpenChange(false)}
                            className="text-muted-foreground hover:bg-muted/50 absolute top-2 right-3 inline-flex size-8 items-center justify-center rounded-md"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                    <CanonicalPlayPreviewBody key={payload.branch_id ?? payload.workspace_id} payload={payload} />
                </>
            )}
        </HeadlessResponsiveDialog>
    );
}
