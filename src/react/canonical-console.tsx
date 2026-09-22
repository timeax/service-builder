// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import type { ProductDefinition, ProductDefinitionDiagnostic, ProductNotice } from '@elqora/dgp-spec';
import type { HostPublicationDiagnostic, PublicationValidationResult } from '@elqora/dgp-validation';
import type { BackendError, CanvasAPI } from '@elqora/dgp-workspace';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiInfo, FiTrash2, FiX } from 'react-icons/fi';

type ConsoleSubTab = 'validation' | 'logs' | 'notices';
type ScopeFilter = 'all' | 'activeNode';
type SeverityFilter = 'all' | 'error' | 'warning' | 'info';
type Diagnostic = ProductDefinitionDiagnostic | HostPublicationDiagnostic;
interface ConsoleLog { id: number; code: string; message: string; createdAt: number; nodeId?: string }
type IntroState = Record<ConsoleSubTab, { minimized: boolean; closed: boolean }>;

const introCopy: Record<ConsoleSubTab, { title: string; description: string }> = {
    validation: { title: 'Validation Console', description: 'Validation rows reflect canonical definition and publication consistency checks.' },
    logs: { title: 'Runtime Logs', description: 'Logs come from workspace/editor runtime events and can be cleared or dismissed.' },
    notices: { title: 'Schema Notices', description: 'Notices come from product props and include public/private messaging with global or node scope.' },
};

function severityBadge(severity: string) {
    return cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
        severity === 'error' && 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
        severity === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
        severity === 'info' && 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200');
}

function severityIcon(severity: string) {
    if (severity === 'error') return <FiAlertCircle className="text-lg text-rose-500" />;
    if (severity === 'warning') return <FiAlertCircle className="text-lg text-amber-500" />;
    return <FiInfo className="text-lg text-sky-500" />;
}

function diagnosticNodeIds(diagnostic: Diagnostic, definition: ProductDefinition | null): string[] {
    const ids = new Set<string>();
    const meta = diagnostic.meta ?? {};
    for (const key of ['node_id', 'field_id', 'filter_id', 'option_id'] as const) {
        if (typeof meta[key] === 'string') ids.add(meta[key]);
    }
    for (const key of ['node_ids', 'field_ids', 'filter_ids', 'option_ids', 'affected_ids'] as const) {
        if (Array.isArray(meta[key])) for (const id of meta[key]) if (typeof id === 'string') ids.add(id);
    }
    const segments = diagnostic.path.split('/').slice(1);
    if (definition && (segments[0] === 'filters' || segments[0] === 'fields')) {
        const index = Number(segments[1]);
        if (Number.isInteger(index) && index >= 0) {
            const root = segments[0] === 'filters' ? definition.filters[index] : definition.fields[index];
            if (root) {
                let node: { id: string; options?: readonly { id: string; options?: readonly unknown[] }[] } = root;
                ids.add(node.id);
                for (let offset = 2; segments[offset] === 'options' && segments[offset + 1] !== undefined; offset += 2) {
                    const optionIndex = Number(segments[offset + 1]);
                    const option = Number.isInteger(optionIndex) ? node.options?.[optionIndex] : undefined;
                    if (!option) break;
                    node = option as typeof node;
                    ids.add(node.id);
                }
            }
        }
    }
    return [...ids];
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
    return String(error);
}

export function CanonicalConsole({ validation, notices, definition, selectedIds, api, workspaceError, shortcutLabel, onLogCountChange }: {
    validation: PublicationValidationResult | null;
    notices: readonly ProductNotice[];
    definition: ProductDefinition | null;
    selectedIds: readonly string[];
    api?: CanvasAPI;
    workspaceError: BackendError | null;
    shortcutLabel: string;
    onLogCountChange(count: number): void;
}) {
    const [subTab, setSubTab] = useState<ConsoleSubTab>('validation');
    const [scope, setScope] = useState<ScopeFilter>('all');
    const [severity, setSeverity] = useState<SeverityFilter>('all');
    const [intro, setIntro] = useState<IntroState>({
        validation: { minimized: false, closed: false },
        logs: { minimized: false, closed: false },
        notices: { minimized: false, closed: false },
    });
    const [logs, setLogs] = useState<ConsoleLog[]>([]);
    useEffect(() => onLogCountChange(logs.length), [logs.length, onLogCountChange]);
    const nextLogId = useRef(0);
    const appendLog = useCallback((code: string, message: string, nodeId?: string) => {
        const row = { id: ++nextLogId.current, code, message, createdAt: Date.now(), nodeId };
        setLogs((current) => [row, ...current].slice(0, 100));
    }, []);
    useEffect(() => {
        if (!api) return;
        const editorOff = api.on('editor:error', ({ command, error }) => appendLog(command, errorMessage(error), api.selection.primary()));
        const commentsOff = api.on('comments:error', ({ operation, error }) => appendLog(`comments:${operation}`, errorMessage(error), api.selection.primary()));
        return () => { editorOff(); commentsOff(); };
    }, [api, appendLog]);
    useEffect(() => {
        if (workspaceError) appendLog(workspaceError.code, workspaceError.message, api?.selection.primary());
    }, [api, appendLog, workspaceError]);

    const activeIds = useMemo(() => new Set(selectedIds), [selectedIds]);
    const diagnostics = useMemo<Diagnostic[]>(() => validation ? [...validation.protocol.diagnostics, ...validation.policyDiagnostics] : [], [validation]);
    const validationRows = diagnostics.filter((row) => (scope === 'all' || diagnosticNodeIds(row, definition).some((id) => activeIds.has(id))) && (severity === 'all' || row.severity === severity));
    const logRows = logs.filter((row) => scope === 'all' || (row.nodeId !== undefined && activeIds.has(row.nodeId)));
    const noticeRows = notices.filter((row) => (scope === 'all' || (row.target.scope === 'node' && activeIds.has(row.target.node_id))) && (severity === 'all' || row.severity === severity));
    const tabs: Array<{ id: ConsoleSubTab; label: string; count: number }> = [
        { id: 'validation', label: 'Validation', count: validationRows.length },
        { id: 'logs', label: 'Logs', count: logRows.length },
        { id: 'notices', label: 'Notices', count: noticeRows.length },
    ];
    const focusNode = (id: string) => { api?.select([id], id); api?.set_highlighted([id]); };
    const chip = (id: string) => definition?.filters.find((item) => item.id === id)?.label
        ?? definition?.fields.find((item) => item.id === id)?.label ?? id;
    const toggleIntro = () => setIntro((current) => ({ ...current, [subTab]: { ...current[subTab], minimized: !current[subTab].minimized } }));
    const closeIntro = () => setIntro((current) => ({ ...current, [subTab]: { ...current[subTab], closed: true } }));
    return <div className="space-y-4">
        {!intro[subTab].closed ? <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3 dark:border-sky-500/20 dark:bg-sky-500/10">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{introCopy[subTab].title}</p>
                    {!intro[subTab].minimized ? <>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{introCopy[subTab].description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">{validation ? 'Console idle' : 'Validating...'}</span>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">{shortcutLabel}</span>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-slate-900/70">Press Escape to close</span>
                        </div>
                    </> : null}
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={toggleIntro} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900">{intro[subTab].minimized ? 'Expand' : 'Minimize'}</button>
                    <button type="button" onClick={closeIntro} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900">Dismiss</button>
                </div>
            </div>
        </div> : null}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setSubTab(tab.id)} className={cn('inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors', subTab === tab.id ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')}><span>{tab.label}</span><span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{tab.count}</span></button>)}
                </div>
                {subTab === 'logs' && logRows.length ? <Button type="button" variant="ghost" size="sm" onClick={() => setLogs([])} className="h-8 rounded-xl px-3 text-xs"><FiTrash2 /> Clear logs</Button> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Scope</span>
                {([['all', 'All items'], ['activeNode', 'Active node']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setScope(value)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition', scope === value ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')}>{label}</button>)}
                {subTab !== 'logs' ? <>
                    <span className="ml-2 text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Severity</span>
                    {(['all', 'error', 'warning', 'info'] as const).map((value) => <button key={value} type="button" onClick={() => setSeverity(value)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize transition', severity === value ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')}>{value}</button>)}
                </> : null}
            </div>
            {scope === 'activeNode' && !activeIds.size ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No active node selected. Select a node to filter by active scope.</p> : null}
        </div>
        {subTab === 'validation' ? validationRows.length ? <div className="space-y-3">{validationRows.map((row, index) => {
            const ids = diagnosticNodeIds(row, definition);
            return <div key={`${row.code}:${row.path}:${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
                <div className="flex items-start gap-3"><div className="mt-0.5">{severityIcon(row.severity)}</div><div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className={severityBadge(row.severity)}>{row.code.replaceAll('_', ' ')}</span><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.message}</span></div>
                    {ids.length ? <div className="mt-3 flex flex-wrap gap-2">{ids.map((id) => <button key={id} type="button" onClick={() => focusNode(id)} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{chip(id)}</button>)}</div> : null}
                </div></div>
            </div>;
        })}</div> : <EmptyState title="No validation rows for this filter" description={scope === 'activeNode' ? 'No validation rows match the current active node scope.' : 'No validation rows match the current severity filter.'} /> : null}
        {subTab === 'logs' ? logRows.length ? <div className="space-y-3">{logRows.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3"><FiInfo className="mt-0.5 text-lg text-sky-500" /><div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-sky-700 uppercase dark:bg-sky-500/15 dark:text-sky-200">{row.code}</span><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.message}</span></div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400"><span>{new Date(row.createdAt).toLocaleTimeString()}</span><Button type="button" variant="ghost" size="sm" onClick={() => setLogs((current) => current.filter((item) => item.id !== row.id))} className="h-7 rounded-xl px-2 text-xs"><FiX /> Dismiss</Button></div>
            </div></div>
        </div>)}</div> : <EmptyState title="No logs for this filter" description={scope === 'activeNode' ? 'No logs are linked to the current active node scope.' : 'No logs have been captured yet.'} /> : null}
        {subTab === 'notices' ? noticeRows.length ? <div className="space-y-3">{noticeRows.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-start gap-3"><div className="mt-0.5">{severityIcon(row.severity)}</div><div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2"><span className={severityBadge(row.severity)}>{row.kind}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:bg-slate-900 dark:text-slate-300">{row.type}</span><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.title}</span></div>
                {row.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{row.description}</p> : null}
                {row.reason ? <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {row.reason}</p> : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {row.target.scope === 'node' ? <button type="button" onClick={() => { if (row.target.scope === 'node') focusNode(row.target.node_id); }} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">{chip(row.target.node_id)}</button> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">Global notice</span>}
                    {row.marked_at ? <span>{new Date(row.marked_at).toLocaleString()}</span> : null}
                    {typeof row.meta?.icon === 'string' ? <span>Icon: {row.meta.icon}</span> : null}
                    {typeof row.meta?.color === 'string' ? <span>Color: {row.meta.color}</span> : null}
                </div>
            </div></div>
        </div>)}</div> : <EmptyState title="No notices for this filter" description={scope === 'activeNode' ? 'No node-scoped notices match the current active node.' : 'No notices match the current severity filter.'} /> : null}
    </div>;
}
