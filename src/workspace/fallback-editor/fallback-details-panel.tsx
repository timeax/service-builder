import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { useActiveFallbackRegistrations, useFallbackEditor, usePrimaryServiceList } from '@timeax/digital-service-engine/react';
import type { FallbackRegistration, FallbackScopeRef } from '@timeax/digital-service-engine/schema';
import { useMemo } from 'react';
import { DetailRow, SectionCard, SectionHeader, ToneBadge } from './shared.tsx';

export function FallbackDetailsPanel() {
    const { activeServiceId, state, settings, check } = useFallbackEditor();
    const services = usePrimaryServiceList();
    const registrations = useActiveFallbackRegistrations();

    const service = useMemo(() => services.find((entry) => String(entry.id) === String(activeServiceId)), [services, activeServiceId]);

    const diagnostics = useMemo(() => {
        return registrations.flatMap((registration) => {
            const context = toScopeRef(registration);
            const result = check(context, registration.services);
            const rejected = result.rejected.map((item) => ({
                scope: registration.scope,
                scopeId: registration.scopeId,
                candidate: item.candidate,
                reasons: item.reasons,
            }));

            if (result.warnings.length === 0 && rejected.length === 0) {
                return [
                    {
                        scope: registration.scope,
                        scopeId: registration.scopeId,
                        candidate: null,
                        reasons: ['valid'],
                    },
                ];
            }

            return [...rejected, ...result.warnings.map((reason) => ({ scope: registration.scope, scopeId: registration.scopeId, candidate: null, reasons: [reason] }))];
        });
    }, [check, registrations]);

    return (
        <ScrollArea className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="fallback-editor-details-scroll">
            <aside className={'flex flex-col gap-4'}>
                <SectionCard className="p-4">
                    <SectionHeader title="Primary service" description="Current editor target and change state." />

                    <div className="mt-4 space-y-2">
                        <DetailRow
                            label="Service"
                            value={service ? `${service.name ?? 'Unnamed'} (#${String(service.id)})` : 'No service selected'}
                        />
                        <DetailRow label="Platform" value={service?.platform ?? '-'} />
                        <DetailRow label="Rate" value={typeof service?.rate === 'number' ? String(service.rate) : '-'} />
                        <DetailRow label="Changed" value={state.changed ? 'Yes' : 'No'} />
                    </div>
                </SectionCard>

                <SectionCard className="p-4">
                    <SectionHeader title="Policy" description="Effective fallback rules applied by the provider." />

                    <div className="mt-4 space-y-2">
                        <DetailRow label="Constraint fit" value={settings.requireConstraintFit ? 'Enabled' : 'Disabled'} />
                        <DetailRow label="Rate policy" value={formatRatePolicy(settings)} />
                        <DetailRow label="Strategy" value={settings.selectionStrategy ?? 'priority'} />
                        <DetailRow label="Mode" value={settings.mode ?? 'strict'} />
                    </div>
                </SectionCard>

                <SectionCard className="flex min-h-0 flex-col overflow-hidden">
                    <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                        <SectionHeader title="Diagnostics" description="Live validation hints for the selected service registrations." />
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="space-y-2 p-3">
                            {diagnostics.length ? (
                                diagnostics.map((entry, index) => {
                                    const tone =
                                        entry.reasons[0] === 'valid'
                                            ? 'success'
                                            : entry.reasons.includes('rate_violation') || entry.reasons.includes('constraint_mismatch')
                                              ? 'danger'
                                              : 'warning';

                                    return (
                                        <div
                                            key={`${entry.scope}:${String(entry.scopeId ?? 'global')}:${String(entry.candidate ?? 'none')}:${index}`}
                                            className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <ToneBadge label={entry.scope === 'global' ? 'Global' : `Node ${entry.scopeId ?? ''}`.trim()} />
                                                {entry.candidate != null ? (
                                                    <ToneBadge label={`Candidate #${String(entry.candidate)}`} tone="info" />
                                                ) : null}
                                                <ToneBadge label={entry.reasons.join(', ')} tone={tone} />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                                    No registrations selected yet.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </SectionCard>

                <SectionCard className="flex min-h-0 flex-col overflow-hidden">
                    <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                        <SectionHeader title="Current payload" description="Serialized fallback state from the provider." />
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <pre className="p-4 text-xs text-slate-700 dark:text-slate-200">{JSON.stringify(state.current, null, 2)}</pre>
                    </ScrollArea>
                </SectionCard>
            </aside>
        </ScrollArea>
    );
}

function toScopeRef(registration: FallbackRegistration): FallbackScopeRef {
    if (registration.scope === 'global') {
        return {
            scope: 'global',
            primary: registration.primary,
        };
    }

    return {
        scope: 'node',
        nodeId: registration.scopeId!,
    };
}

function formatRatePolicy(settings: ReturnType<typeof useFallbackEditor>['settings']) {
    if (settings.ratePolicy?.kind === 'eq_primary') return 'eq_primary';
    if (settings.ratePolicy?.kind === 'within_pct') return `within_pct (${settings.ratePolicy.pct}%)`;
    if (settings.ratePolicy?.kind === 'at_least_pct_lower') return `at_least_pct_lower (${settings.ratePolicy.pct}%)`;
    if (settings.ratePolicy?.kind === 'lte_primary') return `lte_primary (${settings.ratePolicy.pct}%)`;
    return 'lte_primary (5%)';
}
