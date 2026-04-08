import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { useActiveFallbackRegistrations, useEligibleServiceList, useFallbackEditor } from '@timeax/digital-service-engine/react';
import type { FallbackScopeRef, ServiceIdRef } from '@timeax/digital-service-engine/schema';
import { Plus, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { FallbackAddCandidatesDialog, FallbackAddRegistrationDialog, registrationToScope } from './fallback-dialogs.tsx';
import { EmptyState, SectionCard, SectionHeader, ToneBadge } from './shared.tsx';

export function FallbackRegistrationsPanel() {
    const { activeServiceId, remove, clear, check } = useFallbackEditor();
    const registrations = useActiveFallbackRegistrations();
    const eligibleServices = useEligibleServiceList();

    const [candidatePickerOpen, setCandidatePickerOpen] = useState(false);
    const [candidateContext, setCandidateContext] = useState<FallbackScopeRef | null>(null);
    const [candidatePrimaryId, setCandidatePrimaryId] = useState<ServiceIdRef | undefined>(undefined);
    const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);

    const openCandidatePicker = useCallback((context: FallbackScopeRef, primaryId?: ServiceIdRef) => {
        setCandidateContext(context);
        setCandidatePrimaryId(primaryId);
        setCandidatePickerOpen(true);
    }, []);

    if (activeServiceId === undefined || activeServiceId === null) {
        return (
            <SectionCard className="p-5">
                <EmptyState
                    title="Select a primary service"
                    description="Pick a service from the left sidebar to review or create fallback registrations."
                />
            </SectionCard>
        );
    }

    return (
        <>
            <SectionCard className="flex min-h-0 flex-col flex-1 overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <SectionHeader
                        title="Registered fallbacks"
                        description="Add global or node-scoped registrations, then curate the fallback candidates for each scope."
                        action={
                            <Button type="button" variant="outline" onClick={() => setRegistrationDialogOpen(true)} className="rounded-md">
                                <Plus className="size-4" />
                                Add registration
                            </Button>
                        }
                    />
                </div>

                <ScrollArea className="min-h-0 flex-1" data-testid="fallback-editor-registrations-scroll">
                    <div className="space-y-4 p-4">
                        {registrations.length === 0 ? (
                            <EmptyState
                                title="No registrations yet"
                                description="Create a global or node-scoped registration for the selected primary service."
                            />
                        ) : (
                            registrations.map((registration, index) => {
                                const context = registrationToScope(registration);
                                const candidates = registration.services;

                                return (
                                    <div
                                        key={`${registration.scope}:${String(registration.scopeId ?? 'global')}:${index}`}
                                        className="rounded-md border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <ToneBadge label={registration.scope === 'global' ? 'Global registration' : `Node ${registration.scopeId ?? ''}`.trim()} tone="info" />
                                                    <ToneBadge label={`Primary #${String(registration.primary)}`} />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                    {registration.scope === 'global' ? 'Primary service fallback list' : `Node-scoped fallback list for ${registration.scopeId}`}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button type="button" variant="outline" onClick={() => openCandidatePicker(context, registration.primary)} className="rounded-md">
                                                    <Plus className="size-4" />
                                                    Add fallback
                                                </Button>
                                                <Button type="button" variant="outline" onClick={() => clear(context)} className="rounded-md">
                                                    <Trash2 className="size-4" />
                                                    Clear
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {candidates.length === 0 ? (
                                                <span className="text-xs text-slate-500 dark:text-slate-400">No fallback services yet.</span>
                                            ) : (
                                                candidates.map((candidate) => {
                                                    const preview = check(context, [candidate]);
                                                    const rejected = preview.rejected[0];
                                                    const service = eligibleServices.find((entry) => String(entry.id) === String(candidate));

                                                    return (
                                                        <div
                                                            key={String(candidate)}
                                                            className={[
                                                                'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                                                                rejected
                                                                    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                                                                    : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200',
                                                            ].join(' ')}
                                                        >
                                                            <span>{service ? `#${String(service.id)} - ${service.name ?? 'Unnamed'}` : `#${String(candidate)}`}</span>
                                                            <ToneBadge
                                                                label={rejected ? rejected.reasons.join(', ') : 'valid'}
                                                                tone={rejected ? 'danger' : 'success'}
                                                            />
                                                            <button
                                                                type="button"
                                                                aria-label={`Remove candidate ${String(candidate)}`}
                                                                onClick={() => remove(context, candidate)}
                                                                className="text-current/70 transition hover:text-current"
                                                            >
                                                                <X className="size-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </SectionCard>

            <FallbackAddRegistrationDialog
                open={registrationDialogOpen}
                onClose={() => setRegistrationDialogOpen(false)}
                onSelect={(context, primaryId) => {
                    setRegistrationDialogOpen(false);
                    openCandidatePicker(context, primaryId);
                }}
            />

            <FallbackAddCandidatesDialog
                open={candidatePickerOpen}
                onClose={() => setCandidatePickerOpen(false)}
                context={candidateContext}
                primaryId={candidatePrimaryId}
            />
        </>
    );
}
