import { DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE } from '@/builder/node-context/types.ts';
import { EmptyState } from '@/components/builder/index.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { useInputs } from '@timeax/digital-service-engine/react';
import { useWorkspace } from '@timeax/digital-service-engine/workspace';
import { useMemo, useState } from 'react';
import { CiSearch } from 'react-icons/ci';
import { LuBox, LuShapes } from 'react-icons/lu';
import { WorkspaceBootInlineNotice } from '@/workspace/boot-status.tsx';

type BuiltinAsset = {
    key: string;
    kind: string;
    variant?: string;
    label: string;
};

function toTitle(value: string) {
    return value
        .split(/[-_:]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export default function AssetsPanel() {
    const ws = useWorkspace();
    const { registry } = useInputs();
    const [query, setQuery] = useState('');

    const normalizedBuiltins = useMemo<BuiltinAsset[]>(() => {
        const items: BuiltinAsset[] = [];
        for (const [kind, variants] of registry._store.entries()) {
            for (const [variant] of variants.entries()) {
                const key = `${String(kind)}::${String(variant)}`;
                const label = variant === 'default' ? toTitle(String(kind)) : `${toTitle(String(kind))} (${toTitle(String(variant))})`;
                items.push({
                    key,
                    kind: String(kind),
                    variant: variant === 'default' ? undefined : String(variant),
                    label,
                });
            }
        }
        return items.sort((a, b) => a.label.localeCompare(b.label));
    }, [registry._store]);

    const templates = useMemo(() => {
        return [...(ws.templates.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    }, [ws.templates.data]);

    const lower = query.trim().toLowerCase();
    const filteredBuiltins = lower
        ? normalizedBuiltins.filter((item) => item.label.toLowerCase().includes(lower) || item.kind.toLowerCase().includes(lower))
        : normalizedBuiltins;
    const filteredTemplates = lower
        ? templates.filter(
              (item) =>
                  item.name.toLowerCase().includes(lower) ||
                  String(item.kind ?? '')
                      .toLowerCase()
                      .includes(lower),
          )
        : templates;

    return (
        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <label className="relative">
                <CiSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search assets"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm transition outline-none focus:border-blue-300 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:focus:border-blue-500/40"
                />
            </label>

            <ScrollArea className="mt-3 min-h-0 flex-1 pr-1">
                <section>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                        <LuShapes />
                        Built-in Inputs
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {filteredBuiltins.length ? (
                            filteredBuiltins.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                            DRAG_MIME_ASSET_BUILTIN,
                                            JSON.stringify({
                                                kind: item.kind,
                                                variant: item.variant,
                                                label: item.label,
                                            }),
                                        );
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                                >
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {item.variant ? `${item.kind} / ${item.variant}` : item.kind}
                                    </p>
                                </button>
                            ))
                        ) : (
                            <EmptyState title="No built-ins" description="No registry input entries matched your search." className="min-h-36" />
                        )}
                    </div>
                </section>

                <section className="mt-5">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                        <LuBox />
                        Saved Templates
                    </h4>
                    <WorkspaceBootInlineNotice boot={ws.boot} sections={['templates']} className="mb-3" />
                    <div className="grid grid-cols-2 gap-2">
                        {filteredTemplates.length ? (
                            filteredTemplates.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData(
                                            DRAG_MIME_ASSET_TEMPLATE,
                                            JSON.stringify({
                                                id: item.id,
                                                name: item.name,
                                                kind: item.kind,
                                            }),
                                        );
                                        event.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                                >
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.kind}</p>
                                </button>
                            ))
                        ) : (
                            <EmptyState title="No templates" description="No saved templates matched your search." className="min-h-36" />
                        )}
                    </div>
                </section>
            </ScrollArea>
        </div>
    );
}
