import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { buildEligibleFallbackCandidates, mergeFallbackSelections } from '@/workspace/fallback-quick-add-helpers.ts';
import type { DgpServiceMap, FallbackSettings, ServiceIdRef, ServiceProps } from '@timeax/digital-service-engine/schema';
import { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';
import cloneDeep from 'lodash/cloneDeep';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

type QuickAddNodeLaunch = {
    source: 'node';
    primaryServiceId: ServiceIdRef;
    nodeId: string;
    nodeKind: 'tag' | 'field' | 'option';
    nodeLabel: string;
    tagId?: string;
};

type QuickAddServiceLaunch = {
    source: 'active-service';
    primaryServiceId: ServiceIdRef;
    serviceName?: string;
};

type QuickAddLaunch = QuickAddNodeLaunch | QuickAddServiceLaunch;

type FallbackQuickAddContextValue = {
    openForNode: (input: {
        nodeId: string;
        nodeKind: 'tag' | 'field' | 'option';
        nodeLabel?: string;
        serviceId: ServiceIdRef;
        tagId?: string;
    }) => void;
    openForService: (input: { serviceId: ServiceIdRef; serviceName?: string }) => void;
    close: () => void;
    isOpen: boolean;
};

const noop = () => {};

const defaultContextValue: FallbackQuickAddContextValue = {
    openForNode: noop,
    openForService: noop,
    close: noop,
    isOpen: false,
};

const FallbackQuickAddContext = createContext<FallbackQuickAddContextValue>(defaultContextValue);

export function FallbackQuickAddProvider({ children }: { children: ReactNode }) {
    const canvas = useCanvas();
    const ws = useWorkspace();
    const [launch, setLaunch] = useState<QuickAddLaunch | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [surfaceError, setSurfaceError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const close = useCallback(() => {
        if (saving) return;
        setLaunch(null);
        setSelectedIds([]);
        setSurfaceError(null);
    }, [saving]);

    const openForNode = useCallback(
        (input: { nodeId: string; nodeKind: 'tag' | 'field' | 'option'; nodeLabel?: string; serviceId: ServiceIdRef; tagId?: string }) => {
            setSurfaceError(null);
            setSelectedIds([]);
            setLaunch({
                source: 'node',
                primaryServiceId: input.serviceId,
                nodeId: input.nodeId,
                nodeKind: input.nodeKind,
                nodeLabel: input.nodeLabel ?? input.nodeId,
                tagId: input.tagId,
            });
        },
        [],
    );

    const openForService = useCallback((input: { serviceId: ServiceIdRef; serviceName?: string }) => {
        setSurfaceError(null);
        setSelectedIds([]);
        setLaunch({
            source: 'active-service',
            primaryServiceId: input.serviceId,
            serviceName: input.serviceName,
        });
    }, []);

    const servicesMap = useMemo(() => (ws.services.data ?? {}) as DgpServiceMap, [ws.services.data]);
    const serviceProps = (canvas.api.builder.getProps() ?? canvas.props) as ServiceProps;
    const fallbacks = serviceProps?.fallbacks;
    const settings = ((serviceProps as ServiceProps & { fallbackSettings?: FallbackSettings })?.fallbackSettings ?? {}) as FallbackSettings;

    const candidates = useMemo(() => {
        if (!launch) return [] as Array<{ id: ServiceIdRef; name: string; rate?: number; category?: string }>;

        const eligibleIds = buildEligibleFallbackCandidates({
            launch,
            services: servicesMap,
            fallbacks,
            settings,
            props: serviceProps,
        });

        return eligibleIds.map((id) => {
            const service = (servicesMap as Record<string, any>)[String(id)] ?? {};
            return {
                id,
                name: typeof service.name === 'string' ? service.name : `Service #${String(id)}`,
                rate: typeof service.rate === 'number' ? service.rate : undefined,
                category: typeof service.category === 'string' ? service.category : undefined,
            };
        });
    }, [fallbacks, launch, serviceProps, servicesMap, settings]);

    useEffect(() => {
        setSelectedIds((current) => {
            const next = current.filter((id) => candidates.some((candidate) => String(candidate.id) === id));
            return areSameIds(current, next) ? current : next;
        });
    }, [candidates]);

    useEffect(() => {
        if (!launch) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [close, launch]);

    const toggleCandidate = useCallback((candidateId: ServiceIdRef) => {
        const key = String(candidateId);
        setSelectedIds((current) => (current.includes(key) ? current.filter((id) => id !== key) : [...current, key]));
    }, []);

    const persistProps = useCallback(
        (label: string, mutate: (nextProps: ServiceProps) => void) => {
            const editorAny = canvas.api.editor as unknown as {
                transact?: (name: string, work: () => void) => void;
                replaceProps?: (next: ServiceProps) => void;
            };

            if (typeof editorAny.transact !== 'function' || typeof editorAny.replaceProps !== 'function') {
                throw new Error('Fallback persistence is unavailable on this editor instance');
            }

            editorAny.transact(label, () => {
                const nextProps = cloneDeep((canvas.api.builder.getProps() ?? canvas.props) as ServiceProps);
                mutate(nextProps);
                editorAny.replaceProps?.(nextProps);
            });
        },
        [canvas.api.builder, canvas.api.editor, canvas.props],
    );

    const handleSave = useCallback(async () => {
        if (!launch || selectedIds.length === 0) return;
        setSurfaceError(null);
        setSaving(true);
        try {
            persistProps('Add fallbacks', (nextProps) => {
                const selectedValues = candidates.filter((candidate) => selectedIds.includes(String(candidate.id))).map((candidate) => candidate.id);
                nextProps.fallbacks = mergeFallbackSelections({
                    launch,
                    fallbacks: nextProps.fallbacks,
                    selectedIds: selectedValues,
                });
            });
            setLaunch(null);
            setSelectedIds([]);
        } catch (error) {
            setSurfaceError(error instanceof Error ? error.message : 'Failed to add fallbacks');
        } finally {
            setSaving(false);
        }
    }, [candidates, launch, persistProps, selectedIds]);

    const title = useMemo(() => {
        if (!launch) return 'Add fallbacks';
        if (launch.source === 'node') {
            return `Add fallbacks for ${launch.nodeLabel}`;
        }
        return launch.serviceName ? `Add fallbacks for ${launch.serviceName}` : `Add fallbacks for service #${String(launch.primaryServiceId)}`;
    }, [launch]);

    const description = useMemo(() => {
        if (!launch) return '';
        if (launch.source === 'node') {
            return `Select additional services for the ${launch.nodeKind} node on service #${String(launch.primaryServiceId)}. Existing node-bound fallbacks and active services are excluded.`;
        }
        return `Select additional global fallbacks for service #${String(launch.primaryServiceId)}. Already bound global fallbacks and active services are excluded.`;
    }, [launch]);

    const value = useMemo<FallbackQuickAddContextValue>(
        () => ({
            openForNode,
            openForService,
            close,
            isOpen: launch != null,
        }),
        [close, launch, openForNode, openForService],
    );

    return (
        <FallbackQuickAddContext.Provider value={value}>
            {children}
            {typeof document !== 'undefined' && launch
                ? createPortal(
                      <div
                          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
                          onMouseDown={(event) => {
                              if (event.target === event.currentTarget) close();
                          }}
                      >
                          <div className="flex w-[min(92vw,34rem)] max-w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                                  <div className="min-w-0">
                                      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={close} className="h-9 rounded-xl px-2">
                                      <FiX />
                                  </Button>
                              </div>

                              {surfaceError ? (
                                  <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
                                      {surfaceError}
                                  </div>
                              ) : null}

                              <div className="max-h-[55vh] overflow-auto px-6 py-4">
                                  {candidates.length ? (
                                      <div className="space-y-2">
                                          {candidates.map((candidate) => {
                                              const checked = selectedIds.includes(String(candidate.id));
                                              return (
                                                  <label
                                                      key={String(candidate.id)}
                                                      className={cn(
                                                          'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors',
                                                          checked
                                                              ? 'border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10'
                                                              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900',
                                                      )}
                                                  >
                                                      <input
                                                          type="checkbox"
                                                          checked={checked}
                                                          onChange={() => toggleCandidate(candidate.id)}
                                                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 focus:ring-offset-0 dark:border-slate-700 dark:bg-slate-950"
                                                      />
                                                      <span className="min-w-0 flex-1">
                                                          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{candidate.name}</span>
                                                          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                              Service #{String(candidate.id)}
                                                              {candidate.category ? ` · ${candidate.category}` : ''}
                                                              {candidate.rate != null ? ` · Rate ${candidate.rate}` : ''}
                                                          </span>
                                                      </span>
                                                  </label>
                                              );
                                          })}
                                      </div>
                                  ) : (
                                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
                                          No additional eligible fallbacks are available for this target once bound and active services are excluded.
                                      </div>
                                  )}
                              </div>

                              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {selectedIds.length ? `${selectedIds.length} fallback${selectedIds.length === 1 ? '' : 's'} selected` : 'Choose one or more fallback services to bind'}
                                  </p>
                                  <div className="flex items-center gap-2">
                                      <Button type="button" variant="ghost" onClick={close} disabled={saving} className="rounded-xl">
                                          Cancel
                                      </Button>
                                      <Button type="button" onClick={() => void handleSave()} disabled={!selectedIds.length || saving} className="rounded-xl">
                                          {saving ? 'Adding...' : 'Add fallbacks'}
                                      </Button>
                                  </div>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </FallbackQuickAddContext.Provider>
    );
}

export function useFallbackQuickAdd() {
    return useContext(FallbackQuickAddContext);
}

function areSameIds(a: string[], b: string[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}
