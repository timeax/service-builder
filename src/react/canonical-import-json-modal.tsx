// SPDX-License-Identifier: GPL-3.0-only
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import type { ProductDefinition } from '@elqora/dgp-spec';
import { isProductDefinition, validateProductDefinitionStructure } from '@elqora/dgp-validation';
import type { ServiceCatalogState } from '@elqora/dgp-workspace';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiUpload, FiX } from 'react-icons/fi';

export type ImportTarget = 'props' | 'catalog';
type ImportSource = 'paste' | 'file';

interface ImportJsonModalProps {
    open: boolean;
    target: ImportTarget | null;
    onClose(): void;
    onImportProps(definition: ProductDefinition): void | Promise<void>;
    onImportCatalog(catalog: ServiceCatalogState): void | Promise<void>;
}

type ImportSummary =
    | { kind: 'props'; name: string; tagCount: number; fieldCount: number; noticeCount: number; fallbackCount: number }
    | { kind: 'catalog'; groupCount: number; smartGroupCount: number; activeNodeId: string | null; viewMode: string };
type ParseState =
    | { status: 'idle' }
    | { status: 'error'; message: string }
    | { status: 'ready'; source: ImportSource; payload: ProductDefinition | ServiceCatalogState; summary: ImportSummary };

export function CanonicalImportJsonModal({ open, target, onClose, onImportProps, onImportCatalog }: ImportJsonModalProps) {
    const [rawInput, setRawInput] = useState('');
    const [source, setSource] = useState<ImportSource>('paste');
    const [fileName, setFileName] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [applyError, setApplyError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setRawInput('');
            setSource('paste');
            setFileName(null);
            setPending(false);
            setApplyError(null);
        }
    }, [open, target]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !pending) onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, open, pending]);

    const parseState = useMemo<ParseState>(() => {
        const trimmed = rawInput.trim();
        if (!open || !target || !trimmed) return { status: 'idle' };
        let parsed: unknown;
        try {
            parsed = JSON.parse(trimmed);
        } catch (error) {
            return { status: 'error', message: error instanceof Error ? error.message : 'Invalid JSON.' };
        }
        if (target === 'props') {
            if (!isProductDefinition(parsed)) {
                const diagnostic = validateProductDefinitionStructure(parsed)[0];
                return { status: 'error', message: diagnostic?.message ?? 'JSON must match the canonical ProductDefinition.' };
            }
            return {
                status: 'ready', source, payload: structuredClone(parsed),
                summary: {
                    kind: 'props', name: parsed.name, tagCount: parsed.filters.length, fieldCount: parsed.fields.length,
                    noticeCount: parsed.notices.length,
                    fallbackCount: Object.keys(parsed.fallbacks?.nodes ?? {}).length + Object.keys(parsed.fallbacks?.global ?? {}).length,
                },
            };
        }
        if (!isServiceCatalogState(parsed)) {
            return { status: 'error', message: 'JSON must match ServiceCatalogState with version 1 and a "nodes" array.' };
        }
        return {
            status: 'ready', source, payload: structuredClone(parsed),
            summary: {
                kind: 'catalog', groupCount: parsed.nodes.filter((node) => node.kind === 'group').length,
                smartGroupCount: parsed.nodes.filter((node) => node.kind === 'smart').length,
                activeNodeId: parsed.active_node_id ?? null, viewMode: parsed.view_mode,
            },
        };
    }, [open, rawInput, source, target]);

    if (!open || !target || typeof document === 'undefined') return null;
    const title = target === 'props' ? 'Import props JSON' : 'Import catalog JSON';
    const subtitle = target === 'props'
        ? 'Paste a ProductDefinition JSON payload or load it from a local file.'
        : 'Paste a ServiceCatalogState JSON payload or load it from a local file.';

    const handleApply = async () => {
        if (parseState.status !== 'ready' || pending) return;
        setPending(true);
        setApplyError(null);
        try {
            if (target === 'props') await onImportProps(parseState.payload as ProductDefinition);
            else await onImportCatalog(parseState.payload as ServiceCatalogState);
            onClose();
        } catch (error) {
            setApplyError(error instanceof Error ? error.message : 'Import failed.');
        } finally {
            setPending(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) onClose();
        }}>
            <div role="dialog" aria-modal="true" aria-label={title} className="flex h-[min(90vh,52rem)] w-[min(96vw,56rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending} className="h-9 rounded-xl px-2" aria-label="Close import dialog"><FiX /></Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
                        <div className="space-y-4">
                            <section className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Input</div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="import-json-file">Load JSON file</label>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <label htmlFor="import-json-file" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"><FiUpload />Choose file</label>
                                    <input id="import-json-file" type="file" accept=".json,application/json" className="sr-only" onChange={async (event) => {
                                        const input = event.currentTarget;
                                        const file = input.files?.[0];
                                        if (!file) return;
                                        try {
                                            setRawInput(await readJsonFile(file));
                                            setSource('file');
                                            setFileName(file.name);
                                            setApplyError(null);
                                        } catch (error) {
                                            setApplyError(error instanceof Error ? error.message : 'Failed to read the selected file.');
                                        }
                                        input.value = '';
                                    }} />
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{fileName ?? 'No file selected'}</span>
                                </div>
                                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">You can also paste JSON directly below.</p>
                            </section>
                            <section>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="import-json-textarea">JSON payload</label>
                                <textarea id="import-json-textarea" value={rawInput} onChange={(event) => {
                                    setRawInput(event.target.value);
                                    setSource('paste');
                                    setFileName(null);
                                    setApplyError(null);
                                }} placeholder={target === 'props' ? '{\n  "schema_version": "1.0.0",\n  "filters": [],\n  "fields": []\n}' : '{\n  "version": 1,\n  "nodes": []\n}'} spellCheck={false} className="min-h-[22rem] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/10" />
                            </section>
                        </div>
                        <aside className="space-y-4">
                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Preview</div>
                                <PreviewContent parseState={parseState} />
                            </section>
                            {applyError ? <Alert variant="destructive"><AlertTitle>Import failed</AlertTitle><AlertDescription>{applyError}</AlertDescription></Alert> : null}
                        </aside>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">{parseState.status === 'ready' ? `Ready to import from ${parseState.source === 'file' ? fileName ?? 'file' : 'pasted JSON'}.` : 'Import will stay disabled until the JSON is valid.'}</div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
                        <Button type="button" onClick={() => void handleApply()} disabled={parseState.status !== 'ready' || pending}>{pending ? 'Importing...' : target === 'props' ? 'Import props' : 'Import catalog'}</Button>
                    </div>
                </div>
            </div>
        </div>, document.body,
    );
}

function PreviewContent({ parseState }: { parseState: ParseState }) {
    if (parseState.status === 'idle') return <p className="text-sm text-slate-500 dark:text-slate-400">Paste JSON or load a file to preview what will be imported.</p>;
    if (parseState.status === 'error') return <Alert variant="destructive"><AlertTitle>Validation error</AlertTitle><AlertDescription>{parseState.message}</AlertDescription></Alert>;
    return <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">Source: {parseState.source === 'file' ? 'File upload' : 'Pasted JSON'}</div>
        {parseState.summary.kind === 'props' ? <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Name" value={parseState.summary.name || 'Unnamed'} className="col-span-2" />
            <Metric label="Tags" value={String(parseState.summary.tagCount)} />
            <Metric label="Fields" value={String(parseState.summary.fieldCount)} />
            <Metric label="Notices" value={String(parseState.summary.noticeCount)} />
            <Metric label="Fallbacks" value={String(parseState.summary.fallbackCount)} />
        </dl> : <dl className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Groups" value={String(parseState.summary.groupCount)} />
            <Metric label="Smart groups" value={String(parseState.summary.smartGroupCount)} />
            <Metric label="Active node" value={parseState.summary.activeNodeId ?? 'None'} className="col-span-2" />
            <Metric label="View mode" value={parseState.summary.viewMode} className="col-span-2" />
        </dl>}
        <p className="text-xs text-slate-500 dark:text-slate-400">Applying this will replace the current {parseState.summary.kind}{parseState.summary.kind === 'props' ? ' as a single undoable change.' : '.'}</p>
    </div>;
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
    return <div className={cn('rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900', className)}>
        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{label}</dt>
        <dd className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isServiceCatalogState(value: unknown): value is ServiceCatalogState {
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.nodes) || !Array.isArray(value.expanded_ids) || !Array.isArray(value.pinned_node_ids)) return false;
    if (!['all', 'grouped', 'assigned'].includes(String(value.view_mode))) return false;
    if (!value.expanded_ids.every((id) => typeof id === 'string') || !value.pinned_node_ids.every((id) => typeof id === 'string')) return false;
    if (value.active_node_id !== undefined && typeof value.active_node_id !== 'string') return false;
    return value.nodes.every((node: unknown) => isRecord(node) && typeof node.id === 'string' && typeof node.label === 'string' && isRecord(node.meta) && (
        node.kind === 'group' && Array.isArray(node.service_ids) ||
        node.kind === 'smart' && (node.match === 'all' || node.match === 'any') && Array.isArray(node.rules) && Array.isArray(node.resolved_service_ids)
    ));
}

async function readJsonFile(file: File): Promise<string> {
    if (typeof file.text === 'function') return file.text();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read the selected file.'));
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(file);
    });
}
