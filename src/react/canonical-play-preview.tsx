// SPDX-License-Identifier: GPL-3.0-only
import { HeadlessResponsiveDialog } from '@/components/ui/headless-responsive-dialog';
import { buildOrderPreview, createOrderingSession } from '@elqora/dgp-ordering';
import { FormPaletteOrderingProvider, OrderingInput } from '@elqora/dgp-ordering-form-palette';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { canonicalInputRegistry } from './canonical-input-registry';
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
    const filter = context?.filter.filter;
    const lineage = context?.filter.lineage ?? [];
    const children = definition.filters.filter((candidate) => candidate.bind_id === filter?.id);
    const visibleFields = definition.fields.filter((field) => context?.visibility.fieldIds.includes(field.id));

    return (
        <FormPaletteOrderingProvider
            session={session}
            definition={definition}
            registry={canonicalInputRegistry}
            template_context={{ preview, preview_result: previewResult }}
        >
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                    <div className="flex flex-wrap gap-2" aria-label="Order tags">
                        {lineage.length > 1 && (
                            <button type="button" onClick={() => session.set_filter_id(lineage[lineage.length - 2]!.id)}>
                                Back
                            </button>
                        )}
                        {lineage.slice(1).map((candidate) => (
                            <button
                                key={candidate.id}
                                type="button"
                                aria-pressed={candidate.id === filter?.id}
                                onClick={() => session.set_filter_id(candidate.id)}
                            >
                                {candidate.label}
                            </button>
                        ))}
                        {children.map((candidate) => (
                            <button key={candidate.id} type="button" onClick={() => session.set_filter_id(candidate.id)}>
                                {candidate.label}
                            </button>
                        ))}
                    </div>
                    {visibleFields.map((field) => (
                        <OrderingInput key={field.id} field={field} />
                    ))}
                    {'failure' in previewResult && <p role="alert">{previewResult.failure.message}</p>}
                </div>
                <div className="shrink-0 border-t p-4 text-sm" aria-label="Order preview summary">
                    <div>Tag: {filter?.label ?? 'None'}</div>
                    <div>Quantity: {preview?.quantity ?? '—'}</div>
                    <div>
                        Min: {preview?.min ?? '—'} Max: {preview?.max ?? '—'}
                    </div>
                    <div>Services: {preview?.service_ids.join(', ') ?? '—'}</div>
                    <div>Selected options: {Object.values(state.selections).flat().join(', ') || '—'}</div>
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
            className="max-w-full"
            maxVh={100}
        >
            {payload && <CanonicalPlayPreviewBody key={payload.branch_id ?? payload.workspace_id} payload={payload} />}
        </HeadlessResponsiveDialog>
    );
}
