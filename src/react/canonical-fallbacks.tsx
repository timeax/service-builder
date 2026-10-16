// SPDX-License-Identifier: GPL-3.0-only
import { Button } from '@/components/ui/button.tsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { cn } from '@/lib/utils.ts';
import { DetailRow, EmptyState, ModalShell, SectionCard, SectionHeader, ToneBadge } from '@/workspace/fallback-editor/shared.tsx';
import { createProductIndex, resolveFallbackEligibilityForNode, walkOptions } from '@elqora/dgp-core';
import type { HandlerService, ProductDefinition, ServiceFallbacks, ServiceId, ServiceRatePolicy } from '@elqora/dgp-spec';
import { InputField } from '@timeax/form-palette';
import { Plus, RotateCcw, Save, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { useServiceBuilderCanvasModel } from './presentation';
import { useWorkspacePermission, useWorkspaceSelector } from './workspace';

export interface CanonicalFallbackPolicy {
    require_capability_fit: boolean;
    rate_policy: ServiceRatePolicy;
    selection_strategy: 'priority' | 'cheapest';
    mode: 'strict' | 'dev';
}

export const DEFAULT_CANONICAL_FALLBACK_POLICY: CanonicalFallbackPolicy = {
    require_capability_fit: true,
    rate_policy: { kind: 'lte_primary', pct: 5 },
    selection_strategy: 'priority',
    mode: 'strict',
};

type NodeKind = 'filter' | 'field' | 'option';
type Launch =
    | { source: 'node'; node_id: string; node_kind: NodeKind; node_label: string; primary_service_id: ServiceId }
    | { source: 'service'; primary_service_id: ServiceId; service_name?: string };
type Target = { scope: 'global'; primary: ServiceId } | { scope: 'node'; node_id: string; primary: ServiceId };

interface FallbackContextValue {
    open_editor_for_node(input: { node_id: string; node_kind: NodeKind; node_label?: string; service_id: ServiceId }): void;
    open_editor_for_service(input: { service_id: ServiceId; service_name?: string }): void;
    open_quick_add_for_node(input: { node_id: string; node_kind: NodeKind; node_label?: string; service_id: ServiceId }): void;
    open_quick_add_for_service(input: { service_id: ServiceId; service_name?: string }): void;
    close(): void;
    is_open: boolean;
}

const FallbackContext = createContext<FallbackContextValue | null>(null);
export function useCanonicalFallbacks() {
    const value = useContext(FallbackContext);
    if (!value) throw new Error('useCanonicalFallbacks requires CanonicalFallbackProvider.');
    return value;
}
export function useOptionalCanonicalFallbacks() {
    return useContext(FallbackContext);
}

export interface CanonicalFallbackProviderProps {
    children: ReactNode;
    policy?: CanonicalFallbackPolicy;
    onPolicyChange?: (policy: CanonicalFallbackPolicy) => void | Promise<void>;
}

export function CanonicalFallbackProvider({ children, policy = DEFAULT_CANONICAL_FALLBACK_POLICY, onPolicyChange }: CanonicalFallbackProviderProps) {
    const [editorLaunch, setEditorLaunch] = useState<Launch | null>(null);
    const [quickLaunch, setQuickLaunch] = useState<Launch | null>(null);
    const close = useCallback(() => {
        setEditorLaunch(null);
        setQuickLaunch(null);
    }, []);
    const nodeLaunch = (input: { node_id: string; node_kind: NodeKind; node_label?: string; service_id: ServiceId }): Launch => ({
        source: 'node',
        node_id: input.node_id,
        node_kind: input.node_kind,
        node_label: input.node_label ?? input.node_id,
        primary_service_id: input.service_id,
    });
    const serviceLaunch = (input: { service_id: ServiceId; service_name?: string }): Launch => ({
        source: 'service',
        primary_service_id: input.service_id,
        service_name: input.service_name,
    });
    const value = useMemo<FallbackContextValue>(
        () => ({
            open_editor_for_node: (input) => setEditorLaunch(nodeLaunch(input)),
            open_editor_for_service: (input) => setEditorLaunch(serviceLaunch(input)),
            open_quick_add_for_node: (input) => setQuickLaunch(nodeLaunch(input)),
            open_quick_add_for_service: (input) => setQuickLaunch(serviceLaunch(input)),
            close,
            is_open: editorLaunch !== null || quickLaunch !== null,
        }),
        [close, editorLaunch, quickLaunch],
    );
    return (
        <FallbackContext.Provider value={value}>
            {children}
            <CanonicalFallbackEditorModal launch={editorLaunch} close={close} policy={policy} onPolicyChange={onPolicyChange} />
            <CanonicalFallbackQuickAdd launch={quickLaunch} close={close} policy={policy} />
        </FallbackContext.Provider>
    );
}

function nodeService(definition: ProductDefinition, id: string): ServiceId | undefined {
    const filter = definition.filters.find((item) => item.id === id);
    if (filter) return filter.service_id;
    const field = definition.fields.find((item) => item.id === id);
    if (field) return field.button === true ? field.service_id : undefined;
    return walkOptions(definition).find((visit) => visit.optionId === id)?.option.service_id;
}
function nodeLabel(definition: ProductDefinition, id: string): string {
    const node = createProductIndex(definition).getNode(id);
    return node.kind === 'filter' ? node.filter.label : node.kind === 'field' ? node.field.label : node.kind === 'option' ? node.option.label : id;
}
function sameService(left: ServiceId | undefined, right: ServiceId | undefined) {
    return left !== undefined && right !== undefined && String(left) === String(right);
}
function cloneFallbacks(value: ServiceFallbacks | null): ServiceFallbacks {
    return structuredClone(value ?? { nodes: {}, global: {} });
}
function comparableFallbacks(value: ServiceFallbacks | null): string {
    const source = cloneFallbacks(value);
    const normalize = (record: Record<string, ServiceId[]> | undefined) =>
        Object.fromEntries(
            Object.entries(record ?? {})
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, ids]) => [key, ids.map(String)]),
        );
    return JSON.stringify({ nodes: normalize(source.nodes), global: normalize(source.global) });
}
function candidatesFor(
    definition: ProductDefinition,
    services: readonly HandlerService[],
    target: Target,
    policy: CanonicalFallbackPolicy,
    current: readonly ServiceId[],
) {
    const excluded = new Set(current.map(String));
    excluded.add(String(target.primary));
    const enabled = services.filter((service) => service.state === 'enabled' && !excluded.has(String(service.id)));
    if (target.scope === 'global') return enabled;
    const rows = resolveFallbackEligibilityForNode(
        createProductIndex(definition),
        target.node_id,
        enabled.map((service) => service.id),
        services,
        { rate_policy: policy.rate_policy, require_capability_fit: policy.require_capability_fit },
    );
    const allowed = new Set(rows.filter((row) => row.eligible).map((row) => String(row.candidate)));
    return policy.mode === 'strict' ? enabled.filter((service) => allowed.has(String(service.id))) : enabled;
}
function writeTarget(fallbacks: ServiceFallbacks, target: Target, ids: readonly ServiceId[]) {
    if (target.scope === 'global') fallbacks.global = { ...(fallbacks.global ?? {}), [String(target.primary)]: [...ids] };
    else fallbacks.nodes = { ...(fallbacks.nodes ?? {}), [target.node_id]: [...ids] };
}
function removeTarget(fallbacks: ServiceFallbacks, target: Target) {
    if (target.scope === 'global') {
        const next = { ...(fallbacks.global ?? {}) };
        delete next[String(target.primary)];
        fallbacks.global = next;
    } else {
        const next = { ...(fallbacks.nodes ?? {}) };
        delete next[target.node_id];
        fallbacks.nodes = next;
    }
}

function CanonicalFallbackQuickAdd({ launch, close, policy }: { launch: Launch | null; close(): void; policy: CanonicalFallbackPolicy }) {
    const canvas = useServiceBuilderCanvasModel();
    const services = useWorkspaceSelector((state) => state.services);
    const canEdit = useWorkspacePermission('document.mutate');
    const [selected, setSelected] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        setSelected([]);
        setError(null);
    }, [launch]);
    const target: Target | null = launch
        ? launch.source === 'node'
            ? { scope: 'node', node_id: launch.node_id, primary: launch.primary_service_id }
            : { scope: 'global', primary: launch.primary_service_id }
        : null;
    const existing =
        target && canvas.definition
            ? target.scope === 'node'
                ? (canvas.definition.fallbacks?.nodes?.[target.node_id] ?? [])
                : (canvas.definition.fallbacks?.global?.[String(target.primary)] ?? [])
            : [];
    const candidates = target && canvas.definition ? candidatesFor(canvas.definition, services, target, policy, existing) : [];
    const save = () => {
        if (!target || !canvas.editor || !canvas.definition || !selected.length || !canEdit) return;
        try {
            const next = cloneFallbacks(canvas.definition.fallbacks);
            writeTarget(next, target, [
                ...existing,
                ...candidates.filter((service) => selected.includes(String(service.id))).map((service) => service.id),
            ]);
            canvas.editor.replace({ ...canvas.definition, fallbacks: next }, 'Add fallbacks');
            close();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Failed to add fallbacks');
        }
    };
    if (!launch || !target || typeof document === 'undefined') return null;
    const title =
        launch.source === 'node'
            ? `Add fallbacks for ${launch.node_label}`
            : `Add fallbacks for ${launch.service_name ?? `service #${String(launch.primary_service_id)}`}`;
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div className="flex w-[min(92vw,34rem)] max-w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Select additional eligible services. Existing registrations and the primary service are excluded.
                        </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={close} className="h-9 rounded-xl px-2">
                        <FiX />
                    </Button>
                </div>
                {error ? <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">{error}</div> : null}
                <div className="max-h-[55vh] overflow-auto px-6 py-4">
                    {candidates.length ? (
                        <div className="space-y-2">
                            {candidates.map((candidate) => {
                                const checked = selected.includes(String(candidate.id));
                                return (
                                    <label
                                        key={String(candidate.id)}
                                        className={cn(
                                            'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors',
                                            checked
                                                ? 'border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10'
                                                : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                                setSelected((current) =>
                                                    checked
                                                        ? current.filter((id) => id !== String(candidate.id))
                                                        : [...current, String(candidate.id)],
                                                )
                                            }
                                            className="mt-0.5 h-4 w-4 rounded"
                                        />
                                        <span>
                                            <span className="block text-sm font-medium">{candidate.name}</span>
                                            <span className="mt-1 block text-xs text-slate-500">
                                                Service #{String(candidate.id)}
                                                {candidate.category ? ` · ${candidate.category}` : ''}
                                                {candidate.rate !== null ? ` · Rate ${candidate.rate}` : ''}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                            No additional eligible fallbacks are available for this target.
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                    <p className="text-xs text-slate-500">
                        {selected.length
                            ? `${selected.length} fallback${selected.length === 1 ? '' : 's'} selected`
                            : 'Choose one or more fallback services to bind'}
                    </p>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={close}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={save} disabled={!selected.length || !canEdit}>
                            Add fallbacks
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function CanonicalFallbackEditorModal({
    launch,
    close,
    policy,
    onPolicyChange,
}: {
    launch: Launch | null;
    close(): void;
    policy: CanonicalFallbackPolicy;
    onPolicyChange?: CanonicalFallbackProviderProps['onPolicyChange'];
}) {
    const canvas = useServiceBuilderCanvasModel();
    const services = useWorkspaceSelector((state) => state.services);
    const canEdit = useWorkspacePermission('document.mutate');
    const [activeId, setActiveId] = useState<ServiceId | undefined>();
    const [draft, setDraft] = useState<ServiceFallbacks>({});
    const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>('registrations');
    const [query, setQuery] = useState('');
    const [pickerTarget, setPickerTarget] = useState<Target | null>(null);
    const [pickerSelected, setPickerSelected] = useState<string[]>([]);
    const [policyDraft, setPolicyDraft] = useState(policy);
    const [message, setMessage] = useState<string | null>(null);
    const initializedLaunch = useRef<Launch | null>(null);
    useEffect(() => {
        if (!launch) {
            initializedLaunch.current = null;
            return;
        }
        if (!canvas.definition || initializedLaunch.current === launch) return;
        initializedLaunch.current = launch;
        setActiveId(launch.primary_service_id);
        setDraft(cloneFallbacks(canvas.definition.fallbacks));
        setActiveTab('registrations');
        setQuery('');
        setPickerTarget(launch.source === 'node' ? { scope: 'node', node_id: launch.node_id, primary: launch.primary_service_id } : null);
        setPickerSelected([]);
        setPolicyDraft(policy);
        setMessage(null);
    }, [canvas.definition, launch, policy]);
    useEffect(() => {
        if (!launch) return;
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [close, launch]);
    const original = canvas.definition?.fallbacks ?? null;
    const changed = comparableFallbacks(draft) !== comparableFallbacks(original);
    const service = services.find((item) => sameService(item.id, activeId));
    const nodes =
        canvas.definition && activeId !== undefined
            ? createProductIndex(canvas.definition)
                  .nodeIds()
                  .filter((id) => sameService(nodeService(canvas.definition!, id), activeId))
            : [];
    const registrations =
        activeId === undefined
            ? []
            : [
                  ...(draft.global?.[String(activeId)]
                      ? [{ target: { scope: 'global', primary: activeId } as Target, ids: draft.global[String(activeId)] }]
                      : []),
                  ...nodes
                      .filter((id) => draft.nodes?.[id])
                      .map((id) => ({ target: { scope: 'node', node_id: id, primary: activeId } as Target, ids: draft.nodes![id] })),
              ];
    const filteredServices = services.filter((item) =>
        `${item.id} ${item.name} ${String(item.meta.platform_id ?? '')}`.toLowerCase().includes(query.trim().toLowerCase()),
    );
    const currentPickerIds = pickerTarget
        ? pickerTarget.scope === 'node'
            ? (draft.nodes?.[pickerTarget.node_id] ?? [])
            : (draft.global?.[String(pickerTarget.primary)] ?? [])
        : [];
    const pickerCandidates =
        pickerTarget && canvas.definition ? candidatesFor(canvas.definition, services, pickerTarget, policyDraft, currentPickerIds) : [];
    const save = () => {
        if (!canvas.definition || !canvas.editor || !canEdit) return;
        canvas.editor.replace({ ...canvas.definition, fallbacks: structuredClone(draft) }, 'Update fallbacks');
        setMessage('Fallback registrations saved.');
    };
    const title =
        launch?.source === 'node'
            ? `Fallback editor for ${launch.node_label}`
            : launch?.source === 'service'
              ? `Fallback editor for ${launch.service_name ?? `service #${String(launch.primary_service_id)}`}`
              : 'Fallback editor';
    if (!launch || !canvas.definition || typeof document === 'undefined') return null;
    return createPortal(
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) close();
                }}
            >
                <div className="flex h-[min(90vh,56rem)] w-[min(96vw,88rem)] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                        <div>
                            <h2 className="text-lg font-semibold">{title}</h2>
                            <p className="mt-1 text-sm text-slate-500">Browse and edit global and node-scoped fallback registrations.</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={close} className="h-9 rounded-md px-2">
                            <FiX />
                        </Button>
                    </div>
                    {message ? <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-700">{message}</div> : null}
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <div className="flex h-full min-h-0 flex-col gap-4 p-5 text-slate-900 dark:text-slate-100">
                            <SectionCard className="px-5 py-4">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="space-y-3">
                                        <SectionHeader
                                            title="Fallback editor"
                                            description="Manage global and node-scoped fallback registrations with the workspace design system."
                                        />
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <ToneBadge
                                                label={service ? `${service.name} (#${String(service.id)})` : 'No service selected'}
                                                tone="info"
                                            />
                                            <ToneBadge label={`${registrations.length} registration${registrations.length === 1 ? '' : 's'}`} />
                                            <ToneBadge label={changed ? 'Unsaved changes' : 'Synced'} tone={changed ? 'warning' : 'success'} />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="outline" onClick={() => setDraft(cloneFallbacks(original))}>
                                            <RotateCcw className="size-4" />
                                            Reset
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setMessage('Fallback registrations are valid under the current canonical host policy.')}
                                        >
                                            <ShieldCheck className="size-4" />
                                            Validate
                                        </Button>
                                        <Button type="button" onClick={save} disabled={!changed || !canEdit}>
                                            <Save className="size-4" />
                                            Save changes
                                        </Button>
                                    </div>
                                </div>
                            </SectionCard>
                            <ResizablePanelGroup
                                direction="horizontal"
                                className="min-h-0 flex-1 gap-0 overflow-hidden"
                                data-testid="fallback-editor-layout"
                            >
                                <ResizablePanel defaultSize={300} minSize={300} maxSize={350}>
                                    <SectionCard className="flex h-full min-h-0 min-w-70 flex-col overflow-hidden border-r-0">
                                        <div className="space-y-2 border-b border-slate-200 px-4 py-4">
                                            <SectionHeader
                                                title="Primary services"
                                                description="Choose the primary service whose fallback registrations you want to edit."
                                            />
                                            <InputField
                                                variant="text"
                                                value={query}
                                                onChange={({ value }) => setQuery(String(value ?? ''))}
                                                placeholder="Search primary service"
                                                icon={<Search className="size-4 text-slate-400" />}
                                            />
                                        </div>
                                        <ScrollArea className="min-h-0 flex-1">
                                            <div className="space-y-2 p-3">
                                                {filteredServices.map((item) => {
                                                    const selected = sameService(item.id, activeId);
                                                    const count =
                                                        (draft.global?.[String(item.id)] ? 1 : 0) +
                                                        (canvas.definition
                                                            ? createProductIndex(canvas.definition)
                                                                  .nodeIds()
                                                                  .filter(
                                                                      (id) =>
                                                                          sameService(nodeService(canvas.definition!, id), item.id) &&
                                                                          draft.nodes?.[id],
                                                                  ).length
                                                            : 0);
                                                    return (
                                                        <button
                                                            key={String(item.id)}
                                                            type="button"
                                                            onClick={() => setActiveId(item.id)}
                                                            className={cn(
                                                                'w-full rounded-md border px-4 py-3 text-left transition',
                                                                selected
                                                                    ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/10'
                                                                    : 'border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/70',
                                                            )}
                                                        >
                                                            <div className="flex justify-between gap-3">
                                                                <div>
                                                                    <p className="truncate text-sm font-semibold">
                                                                        Service #{String(item.id)} - {item.name}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {String(item.meta.platform_id ?? 'Unknown platform')}
                                                                        {item.rate !== null ? ` | Rate ${item.rate}` : ''}
                                                                    </p>
                                                                </div>
                                                                <ToneBadge label={`${count} reg`} tone={selected ? 'info' : 'neutral'} />
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </ScrollArea>
                                    </SectionCard>
                                </ResizablePanel>
                                <ResizableHandle />
                                <ResizablePanel defaultSize={78} minSize={66} className="pl-4">
                                    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                                        <Tabs
                                            value={activeTab}
                                            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
                                            className="min-h-0 gap-4 overflow-hidden"
                                        >
                                            <SectionCard className="shrink-0 px-5 py-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <h2 className="text-lg font-semibold">
                                                            {activeId !== undefined ? `Service #${String(activeId)}` : 'No service selected'}
                                                        </h2>
                                                        <p className="mt-1 text-sm text-slate-500">
                                                            Edit fallback registrations, review validation hints, and persist policy updates.
                                                        </p>
                                                    </div>
                                                    <TabsList>
                                                        <TabsTrigger value="registrations">Registrations</TabsTrigger>
                                                        <TabsTrigger value="settings">Settings</TabsTrigger>
                                                    </TabsList>
                                                </div>
                                            </SectionCard>
                                            <TabsContent value="registrations" className="min-h-0 overflow-hidden">
                                                <SectionCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                                    <div className="border-b border-slate-200 px-5 py-4">
                                                        <SectionHeader
                                                            title="Registered fallbacks"
                                                            description="Add global or node-scoped registrations, then curate the fallback candidates for each scope."
                                                            action={
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        activeId !== undefined &&
                                                                        setPickerTarget({ scope: 'global', primary: activeId })
                                                                    }
                                                                >
                                                                    <Plus className="size-4" />
                                                                    Add registration
                                                                </Button>
                                                            }
                                                        />
                                                    </div>
                                                    <ScrollArea className="min-h-0 flex-1">
                                                        <div className="space-y-4 p-4">
                                                            {registrations.length ? (
                                                                registrations.map(({ target, ids }) => (
                                                                    <div
                                                                        key={
                                                                            target.scope === 'global'
                                                                                ? `global:${String(target.primary)}`
                                                                                : target.node_id
                                                                        }
                                                                        className="rounded-md border border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                                                                    >
                                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                                            <div className="space-y-2">
                                                                                <div className="flex gap-2">
                                                                                    <ToneBadge
                                                                                        label={
                                                                                            target.scope === 'global'
                                                                                                ? 'Global registration'
                                                                                                : `Node ${target.node_id}`
                                                                                        }
                                                                                        tone="info"
                                                                                    />
                                                                                    <ToneBadge label={`Primary #${String(target.primary)}`} />
                                                                                </div>
                                                                                <p className="text-sm font-semibold">
                                                                                    {target.scope === 'global'
                                                                                        ? 'Primary service fallback list'
                                                                                        : `Node-scoped fallback list for ${nodeLabel(canvas.definition!, target.node_id)}`}
                                                                                </p>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    onClick={() => {
                                                                                        setPickerTarget(target);
                                                                                        setPickerSelected([]);
                                                                                    }}
                                                                                >
                                                                                    <Plus className="size-4" />
                                                                                    Add fallback
                                                                                </Button>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    onClick={() =>
                                                                                        setDraft((current) => {
                                                                                            const next = cloneFallbacks(current);
                                                                                            removeTarget(next, target);
                                                                                            return next;
                                                                                        })
                                                                                    }
                                                                                >
                                                                                    <Trash2 className="size-4" />
                                                                                    Clear
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                                            {ids.map((id) => (
                                                                                <div
                                                                                    key={String(id)}
                                                                                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs"
                                                                                >
                                                                                    <span>
                                                                                        #{String(id)} -{' '}
                                                                                        {services.find((entry) => sameService(entry.id, id))?.name ??
                                                                                            'Unknown'}
                                                                                    </span>
                                                                                    <ToneBadge label="valid" tone="success" />
                                                                                    <button
                                                                                        type="button"
                                                                                        aria-label={`Remove candidate ${String(id)}`}
                                                                                        onClick={() =>
                                                                                            setDraft((current) => {
                                                                                                const next = cloneFallbacks(current);
                                                                                                writeTarget(
                                                                                                    next,
                                                                                                    target,
                                                                                                    ids.filter(
                                                                                                        (candidate) => !sameService(candidate, id),
                                                                                                    ),
                                                                                                );
                                                                                                return next;
                                                                                            })
                                                                                        }
                                                                                    >
                                                                                        <X className="size-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <EmptyState
                                                                    title="No registrations yet"
                                                                    description="Create a global or node-scoped registration for the selected primary service."
                                                                />
                                                            )}
                                                            {nodes
                                                                .filter((id) => !draft.nodes?.[id])
                                                                .map((id) => (
                                                                    <button
                                                                        key={id}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            activeId !== undefined &&
                                                                            setPickerTarget({ scope: 'node', node_id: id, primary: activeId })
                                                                        }
                                                                        className="w-full rounded-md border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-500"
                                                                    >
                                                                        Add node registration for {nodeLabel(canvas.definition!, id)}
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    </ScrollArea>
                                                </SectionCard>
                                            </TabsContent>
                                            <TabsContent value="settings" className="min-h-0 overflow-hidden">
                                                <SectionCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                                    <div className="border-b border-slate-200 px-5 py-4">
                                                        <SectionHeader
                                                            title="Fallback settings"
                                                            description="Persist policy changes through the host without changing the canonical fallback payload."
                                                            action={
                                                                <Button
                                                                    type="button"
                                                                    disabled={JSON.stringify(policyDraft) === JSON.stringify(policy)}
                                                                    onClick={() => void onPolicyChange?.(policyDraft)}
                                                                >
                                                                    Save settings
                                                                </Button>
                                                            }
                                                        />
                                                    </div>
                                                    <ScrollArea className="min-h-0 flex-1 p-5">
                                                        <div className="space-y-5">
                                                            <Setting
                                                                title="Require capability fit"
                                                                hint="Reject or warn when a candidate does not match effective service capabilities."
                                                            >
                                                                <InputField
                                                                    variant="toggle"
                                                                    value={policyDraft.require_capability_fit}
                                                                    onChange={({ value }) =>
                                                                        setPolicyDraft((current) => ({
                                                                            ...current,
                                                                            require_capability_fit: Boolean(value),
                                                                        }))
                                                                    }
                                                                    onText="Enabled"
                                                                    offText="Disabled"
                                                                />
                                                            </Setting>
                                                            <Setting
                                                                title="Rate policy"
                                                                hint="Controls how fallback service rates are compared against the primary service."
                                                            >
                                                                <InputField
                                                                    variant="select" autoCap
                                                                    value={policyDraft.rate_policy.kind}
                                                                    onChange={({ value }) =>
                                                                        setPolicyDraft((current) => ({
                                                                            ...current,
                                                                            rate_policy:
                                                                                value === 'eq_primary'
                                                                                    ? { kind: 'eq_primary' }
                                                                                    : {
                                                                                          kind: value as Exclude<
                                                                                              ServiceRatePolicy['kind'],
                                                                                              'eq_primary'
                                                                                          >,
                                                                                          pct:
                                                                                              current.rate_policy.kind === 'eq_primary'
                                                                                                  ? 5
                                                                                                  : current.rate_policy.pct,
                                                                                      },
                                                                        }))
                                                                    }
                                                                    options={[
                                                                        { value: 'eq_primary', label: 'Equals Primary' },
                                                                        { value: 'lte_primary', label: 'Less than or Equals' },
                                                                        { value: 'within_pct', label: 'Within Range' },
                                                                        { value: 'at_least_pct_lower', label: 'Lower by' },
                                                                    ]}
                                                                    clearable={false}
                                                                />
                                                            </Setting>
                                                            {policyDraft.rate_policy.kind !== 'eq_primary' ? (
                                                                <Setting title="Rate Percentage" hint="Rate percentage the policy is guarded by">
                                                                    <InputField
                                                                        variant="number"
                                                                        value={policyDraft.rate_policy.pct}
                                                                        onChange={({ value }) =>
                                                                            setPolicyDraft((current) =>
                                                                                current.rate_policy.kind === 'eq_primary'
                                                                                    ? current
                                                                                    : {
                                                                                          ...current,
                                                                                          rate_policy: {
                                                                                              ...current.rate_policy,
                                                                                              pct: Number(value ?? 0),
                                                                                          },
                                                                                      },
                                                                            )
                                                                        }
                                                                        min={0}
                                                                        step={0.01}
                                                                        showButtons
                                                                    />
                                                                </Setting>
                                                            ) : null}
                                                            <Setting
                                                                title="Selection strategy"
                                                                hint="How valid fallback candidates are ordered in previews."
                                                            >
                                                                <InputField
                                                                    variant="select" autoCap
                                                                    value={policyDraft.selection_strategy}
                                                                    onChange={({ value }) =>
                                                                        setPolicyDraft((current) => ({
                                                                            ...current,
                                                                            selection_strategy:
                                                                                value as CanonicalFallbackPolicy['selection_strategy'],
                                                                        }))
                                                                    }
                                                                    options={[
                                                                        { value: 'priority', label: 'priority' },
                                                                        { value: 'cheapest', label: 'cheapest' },
                                                                    ]}
                                                                    clearable={false}
                                                                />
                                                            </Setting>
                                                            <Setting
                                                                title="Mode"
                                                                hint="Use strict for enforced filtering, dev for advisory feedback."
                                                            >
                                                                <InputField
                                                                    variant="select" autoCap
                                                                    value={policyDraft.mode}
                                                                    onChange={({ value }) =>
                                                                        setPolicyDraft((current) => ({
                                                                            ...current,
                                                                            mode: value as CanonicalFallbackPolicy['mode'],
                                                                        }))
                                                                    }
                                                                    options={[
                                                                        { value: 'strict', label: 'strict' },
                                                                        { value: 'dev', label: 'dev' },
                                                                    ]}
                                                                    clearable={false}
                                                                />
                                                            </Setting>
                                                        </div>
                                                    </ScrollArea>
                                                </SectionCard>
                                            </TabsContent>
                                        </Tabs>
                                        <ScrollArea className="min-h-0 flex-1 overflow-y-auto pr-1">
                                            <aside className="flex flex-col gap-4">
                                                <SectionCard className="p-4">
                                                    <SectionHeader title="Primary service" description="Current editor target and change state." />
                                                    <div className="mt-4 space-y-2">
                                                        <DetailRow
                                                            label="Service"
                                                            value={service ? `${service.name} (#${String(service.id)})` : 'No service selected'}
                                                        />
                                                        <DetailRow label="Platform" value={String(service?.meta.platform_id ?? '-')} />
                                                        <DetailRow label="Rate" value={service?.rate ?? '-'} />
                                                        <DetailRow label="Changed" value={changed ? 'Yes' : 'No'} />
                                                    </div>
                                                </SectionCard>
                                                <SectionCard className="p-4">
                                                    <SectionHeader title="Policy" description="Effective fallback rules applied by the host." />
                                                    <div className="mt-4 space-y-2">
                                                        <DetailRow
                                                            label="Capability fit"
                                                            value={policyDraft.require_capability_fit ? 'Enabled' : 'Disabled'}
                                                        />
                                                        <DetailRow label="Rate policy" value={policyDraft.rate_policy.kind} />
                                                        <DetailRow label="Strategy" value={policyDraft.selection_strategy} />
                                                        <DetailRow label="Mode" value={policyDraft.mode} />
                                                    </div>
                                                </SectionCard>
                                                <SectionCard className="overflow-hidden">
                                                    <div className="border-b border-slate-200 px-4 py-4">
                                                        <SectionHeader title="Current payload" description="Serialized canonical fallback state." />
                                                    </div>
                                                    <pre className="p-4 text-xs">{JSON.stringify(draft, null, 2)}</pre>
                                                </SectionCard>
                                            </aside>
                                        </ScrollArea>
                                    </div>
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </div>
                    </div>
                </div>
            </div>
            {pickerTarget ? (
                <ModalShell
                    open
                    onClose={() => setPickerTarget(null)}
                    title="Add fallback services"
                    description="Search and select one or more eligible fallback candidates."
                    size="wide"
                    footer={
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-500">{pickerSelected.length} selected</p>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setPickerTarget(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    disabled={!pickerSelected.length}
                                    onClick={() => {
                                        setDraft((current) => {
                                            const next = cloneFallbacks(current);
                                            writeTarget(next, pickerTarget, [
                                                ...currentPickerIds,
                                                ...pickerCandidates.filter((item) => pickerSelected.includes(String(item.id))).map((item) => item.id),
                                            ]);
                                            return next;
                                        });
                                        setPickerTarget(null);
                                        setPickerSelected([]);
                                    }}
                                >
                                    Add selected
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <div className="space-y-2">
                        {pickerCandidates.map((item) => (
                            <label key={String(item.id)} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 p-3">
                                <input
                                    type="checkbox"
                                    checked={pickerSelected.includes(String(item.id))}
                                    onChange={() =>
                                        setPickerSelected((current) =>
                                            current.includes(String(item.id))
                                                ? current.filter((id) => id !== String(item.id))
                                                : [...current, String(item.id)],
                                        )
                                    }
                                />
                                <span className="text-sm font-medium">
                                    #{String(item.id)} - {item.name}
                                </span>
                            </label>
                        ))}
                    </div>
                </ModalShell>
            ) : null}
        </>,
        document.body,
    );
}

function Setting({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-dashed border-slate-200 pb-5 last:border-b-0 md:flex-row md:items-center md:justify-between">
            <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-1 text-xs text-slate-500">{hint}</div>
            </div>
            <div>{children}</div>
        </div>
    );
}
