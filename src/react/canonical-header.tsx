// SPDX-License-Identifier: GPL-3.0-only
import { BuilderIconButton } from '@/components/builder';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { useMemo, useState } from 'react';
import { BsChevronDown, BsChevronRight } from 'react-icons/bs';
import { MdMenuOpen, MdOutlineSpaceDashboard } from 'react-icons/md';
import { X } from 'lucide-react';
import { createCanonicalBootModel, getCanonicalBootHeadline } from './boot';
import { CanonicalDrafts } from './canonical-drafts';
import type { ServiceBuilderMenuItem } from './contracts';
import { useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

export const CANONICAL_CATALOG_PROMPT = `Organize the supplied canonical DGP HandlerService array into a ServiceCatalogState.

Return JSON only. Use version 1 with snake_case fields: nodes, active_node_id, expanded_ids,
pinned_node_ids, selected_service_id, and view_mode. Group nodes use kind "group" and service_ids.
Smart groups use kind "smart", match, rules, and resolved_service_ids. Preserve every service id and
do not invent handler rates, capabilities, state, or metadata.`;

export const CANONICAL_PRODUCT_DEFINITION_PROMPT = `Create a canonical DGP v1 ProductDefinition from the supplied HandlerService array.

Return JSON only. The root must contain id, name, schema_version "1", description, filters, fields,
order_for_tags, includes_for_buttons, excludes_for_buttons, option_effects_for_buttons,
value_effects_for_triggers, fallbacks, notices, and meta. Use snake_case canonical fields.
Use filters for service contexts and fields/options for authored customer choices. Handler services
remain authoritative for rates, capabilities, pricing, charges, and fulfilment. Do not output legacy
flags, estimates, aliases, compatibility fields, or a legacy ServiceProps wrapper.`;

function MenuRenderer({ items, runtime }: { items: ServiceBuilderMenuItem[]; runtime: ReturnType<typeof useWorkspaceRuntime> }) {
    const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
    return (
        <ul className="flex flex-col gap-1">
            {items.map((item, index) => {
                const hasChildren = (item.children?.length ?? 0) > 0;
                const isOpen = openSubmenus[item.name];
                if (item.render) return <li key={index}>{item.render()}</li>;
                return (
                    <li key={index} className="flex flex-col">
                        <button type="button" onClick={() => { if (hasChildren) setOpenSubmenus((current) => ({ ...current, [item.name]: !current[item.name] })); else if (item.command) void item.command(runtime); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                            {item.icon ? <span className="flex h-4 w-4 items-center justify-center text-slate-500">{item.icon}</span> : null}
                            <span className="flex-1 text-left">{item.name}</span>
                            {hasChildren ? <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}><BsChevronRight className="h-3 w-3" /></span> : null}
                        </button>
                        {hasChildren && isOpen ? <div className="mt-1 ml-4 border-l border-slate-200 pl-2 dark:border-slate-800"><MenuRenderer items={item.children!} runtime={runtime} /></div> : null}
                    </li>
                );
            })}
        </ul>
    );
}

export interface CanonicalHeaderProps {
    menu?: ServiceBuilderMenuItem[];
}

export function CanonicalHeader({ menu = [] }: CanonicalHeaderProps) {
    const runtime = useWorkspaceRuntime();
    const state = useWorkspaceSelector((current) => current);
    const boot = useMemo(() => createCanonicalBootModel(state, runtime), [runtime, state]);
    const currentBranch = state.branches.find((branch) => branch.id === state.current_branch_id);
    const [isPromptsDialogOpen, setIsPromptsDialogOpen] = useState(false);
    const [activePromptTab, setActivePromptTab] = useState<'catalog' | 'product-definition'>('catalog');
    const [copyError, setCopyError] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<'services' | 'policies' | 'definition' | 'fallbacks' | null>(null);

    async function copy(key: typeof copiedKey, value: unknown) {
        try {
            await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
            setCopyError(null);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1500);
        } catch {
            setCopyError('Unable to copy this canonical workspace data. Please copy it manually.');
        }
    }

    const fullMenu: ServiceBuilderMenuItem[] = [
        { name: 'Status', render: () => <div className="px-2 py-1.5 text-xs font-medium tracking-wider text-slate-500 uppercase">{getCanonicalBootHeadline(boot)}</div> },
        { name: 'Prompts', command: () => setIsPromptsDialogOpen(true) },
        ...menu,
    ];

    return (
        <>
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><MdOutlineSpaceDashboard className="text-base" /></span>
                        <div className="flex flex-col justify-center gap-0">
                            <h1 className="text-base leading-tight font-semibold text-slate-900 dark:text-slate-100">Service Builder</h1>
                            <CanonicalDrafts trigger={<button type="button" className="inline-flex cursor-pointer items-center gap-1 rounded-md text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"><span>Active branch - <b>{currentBranch?.name ?? 'Main branch'}</b></span><BsChevronDown /></button>} />
                        </div>
                    </div>
                    <Popover>
                        <PopoverTrigger asChild><span><BuilderIconButton title="Menu"><MdMenuOpen /></BuilderIconButton></span></PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end"><MenuRenderer items={fullMenu} runtime={runtime} /></PopoverContent>
                    </Popover>
                </div>
            </div>
            {isPromptsDialogOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setIsPromptsDialogOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') setIsPromptsDialogOpen(false); }} tabIndex={-1}>
                    <div className="flex h-[min(92vh,900px)] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-3 space-y-3">
                            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Prompts</h2><p className="text-xs text-slate-500 dark:text-slate-400">Catalog and product-definition normalization prompts.</p></div><Button type="button" variant="outline" size="icon" onClick={() => setIsPromptsDialogOpen(false)} aria-label="Close prompts dialog"><X className="h-4 w-4" /></Button></div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" onClick={() => void copy('services', state.services)}>{copiedKey === 'services' ? 'Copied services' : 'Copy services'}</Button>
                                <Button type="button" variant="outline" onClick={() => void copy('policies', state.policy_rules)}>{copiedKey === 'policies' ? 'Copied policies' : 'Copy policies'}</Button>
                                <Button type="button" variant="outline" onClick={() => void copy('definition', state.definition)}>{copiedKey === 'definition' ? 'Copied definition' : 'Copy definition'}</Button>
                                <Button type="button" variant="outline" onClick={() => void copy('fallbacks', state.definition?.fallbacks ?? null)}>{copiedKey === 'fallbacks' ? 'Copied fallbacks' : 'Copy fallbacks'}</Button>
                            </div>
                        </div>
                        {copyError ? <p className="mb-2 text-xs text-rose-600 dark:text-rose-300">{copyError}</p> : null}
                        <Tabs className="min-h-0 flex-1" value={activePromptTab} onValueChange={(value) => setActivePromptTab(value as typeof activePromptTab)}>
                            <TabsList className="mb-3 grid w-full grid-cols-2"><TabsTrigger value="catalog">Catalog prompt</TabsTrigger><TabsTrigger value="product-definition">Service props generator prompt</TabsTrigger></TabsList>
                            <ScrollArea className="min-h-0 w-full flex-1 rounded-md border border-slate-200 p-2 dark:border-slate-800">
                                <TabsContent value="catalog"><pre className="min-h-[520px] rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">{CANONICAL_CATALOG_PROMPT}</pre></TabsContent>
                                <TabsContent value="product-definition"><pre className="min-h-[530px] rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">{CANONICAL_PRODUCT_DEFINITION_PROMPT}</pre></TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>
                </div>
            ) : null}
        </>
    );
}
