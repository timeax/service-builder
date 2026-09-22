// SPDX-License-Identifier: GPL-3.0-only
import { EmptyState, PanelSearch } from '@/components/builder/index.tsx';
import { SortTree, type SortTreeProps, type TreeNode } from '@/components/sort-tree';
import type { SortTreeRef } from '@/components/sort-tree/types.ts';
import { Panel } from '@/components/ui/panel.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { walkOptions } from '@elqora/dgp-core';
import type { FieldOption, ProductField, ProductFilter } from '@elqora/dgp-spec';
import { FolderPlus } from 'lucide-react';
import { type FocusEventHandler, useMemo, useRef, useState } from 'react';
import { BsXDiamondFill } from 'react-icons/bs';
import { CiSearch } from 'react-icons/ci';
import { LuTags } from 'react-icons/lu';
import { MdOutlineAdd } from 'react-icons/md';
import { RxInput } from 'react-icons/rx';
import { VscNewFolder } from 'react-icons/vsc';
import { reorderCanonicalFieldForFilter, reorderCanonicalFilter, reorderCanonicalOption } from './layer-commands';
import { useServiceBuilderCanvasModel } from './presentation';
import { useWorkspacePermission } from './workspace';

function filterTree<T>(nodes: Array<TreeNode<T>>, query: string): Array<TreeNode<T>> {
    if (!query.trim()) return nodes;
    const lower = query.toLowerCase();
    return nodes
        .map((node) => {
            const children = node.children ? filterTree(node.children as Array<TreeNode<T>>, query) : [];
            return node.title.toLowerCase().includes(lower) || children.length ? { ...node, expanded: true, children } : null;
        })
        .filter(Boolean) as Array<TreeNode<T>>;
}

type ChangeHandler<T> = NonNullable<SortTreeProps<T>['onChange']>;

function sameParentOnly(args: Parameters<NonNullable<SortTreeProps['canDrop']>>[0]): boolean {
    if (!args.from) return true;
    const from = args.from.parentPath?.map(String).join('/') ?? '';
    const to = args.to.parentPath?.map(String).join('/') ?? '';
    return from === to;
}

export function CanonicalLayers() {
    const canvas = useServiceBuilderCanvasModel();
    const canMutate = useWorkspacePermission('document.mutate');
    const mutationDeniedReason = canMutate ? undefined : 'You do not have permission to edit this definition.';
    const filtersRef = useRef<SortTreeRef<ProductFilter>>(null);
    const fieldsRef = useRef<SortTreeRef<ProductField | FieldOption>>(null);
    const filterSearchInputRef = useRef<HTMLInputElement>(null);
    const fieldSearchInputRef = useRef<HTMLInputElement>(null);
    const [filterSearch, setFilterSearch] = useState('');
    const [fieldSearch, setFieldSearch] = useState('');
    const [isFilterSearchOpen, setIsFilterSearchOpen] = useState(false);
    const [isFieldSearchOpen, setIsFieldSearchOpen] = useState(false);

    const filters = useMemo(() => filterTree(canvas.layers.filters, filterSearch), [canvas.layers.filters, filterSearch]);
    const fields = useMemo(() => filterTree(canvas.layers.fields, fieldSearch), [canvas.layers.fields, fieldSearch]);
    const contextFilter = canvas.definition?.filters.find((filter) => filter.id === canvas.context_filter_id) ?? canvas.definition?.filters[0];
    const hasFilterSearch = filterSearch.trim() !== '';
    const hasFieldSearch = fieldSearch.trim() !== '';

    const select: SortTreeProps['onSelect'] = (ids, meta) => {
        if (meta?.via === 'api' || canvas.api === undefined) return;
        const primary = ids[0];
        if (primary === undefined) return;
        canvas.api.select(ids.map(String), String(primary));
    };

    const changeFilter: ChangeHandler<ProductFilter> = (_next, detail) => {
        if (!canMutate || canvas.editor === undefined || canvas.definition === null) {
            detail.preventDefault?.();
            return;
        }
        if (detail.type === 'move' || detail.type === 'reorder') {
            detail.preventDefault();
            canvas.editor.replace(reorderCanonicalFilter(canvas.definition, String(detail.node.id), detail.to.index), 'Reorder filter');
            return;
        }
        if (detail.type === 'update') {
            detail.preventDefault();
            canvas.editor.relabel(String(detail.node.id), detail.node.title);
            return;
        }
        if (detail.type === 'insert' && detail.context.via === 'ui.create') {
            detail.preventDefault();
            const parentId = detail.to.parent === null ? undefined : String(detail.to.parent.id);
            const id = canvas.editor.add_filter({
                label: detail.node.title,
                bind_id: parentId,
                meta: {},
            });
            canvas.api?.select([id], id);
        }
    };

    const changeField: ChangeHandler<ProductField | FieldOption> = (_next, detail) => {
        if (!canMutate || canvas.editor === undefined || canvas.definition === null) {
            detail.preventDefault?.();
            return;
        }
        if (!('node' in detail)) return;
        const nodeId = String(detail.node.id);
        if (detail.type === 'move' || detail.type === 'reorder') {
            detail.preventDefault();
            const next =
                canvas.graph.nodes.find((node) => node.id === nodeId)?.kind === 'option'
                    ? reorderCanonicalOption(canvas.definition, nodeId, detail.to.index)
                    : reorderCanonicalFieldForFilter(
                          canvas.definition,
                          contextFilter?.id ?? canvas.definition.filters[0]?.id ?? 'root',
                          nodeId,
                          canvas.layers.fields.map((node) => node.id),
                          detail.to.index,
                      );
            canvas.editor.replace(next, 'Reorder layer');
            return;
        }
        if (detail.type === 'update') {
            detail.preventDefault();
            canvas.editor.relabel(nodeId, detail.node.title);
            return;
        }
        if (detail.type !== 'insert' || detail.context.via !== 'ui.create') return;
        detail.preventDefault();
        const parentId = detail.to.parent === null ? undefined : String(detail.to.parent.id);
        if (parentId === undefined) return;
        const parentNode = canvas.graph.nodes.find((node) => node.id === parentId);
        const fieldId =
            parentNode?.kind === 'field'
                ? parentId
                : parentNode?.kind === 'option'
                  ? walkOptions(canvas.definition).find((visit) => visit.optionId === parentId)?.fieldId
                  : undefined;
        if (fieldId === undefined) return;
        const id = canvas.editor.add_option(fieldId, { label: detail.node.title, meta: {} }, parentNode?.kind === 'option' ? parentId : undefined);
        canvas.api?.select([id], id);
    };

    const addFilter = () => {
        if (!canMutate || canvas.editor === undefined) return;
        const id = canvas.editor.add_filter({
            label: 'New filter',
            bind_id: contextFilter?.id,
            meta: {},
        });
        canvas.api?.select([id], id);
    };

    const addField = () => {
        if (!canMutate || canvas.editor === undefined) return;
        const id = canvas.editor.add_field({
            type: 'text',
            label: 'New Field',
            bind_id: contextFilter?.id,
            meta: {},
        });
        canvas.api?.select([id], id);
    };

    const addOption = () => {
        if (!canMutate || canvas.editor === undefined || canvas.definition === null) return;
        const selectedId = canvas.selection.primary_id;
        if (selectedId === undefined) return;
        const node = canvas.graph.nodes.find((candidate) => candidate.id === selectedId);
        const fieldId =
            node?.kind === 'field'
                ? node.id
                : node?.kind === 'option'
                  ? walkOptions(canvas.definition).find((visit) => visit.optionId === node.id)?.fieldId
                  : undefined;
        if (fieldId === undefined) return;
        const id = canvas.editor.add_option(fieldId, { label: 'New option', meta: {} }, node?.kind === 'option' ? node.id : undefined);
        canvas.api?.select([id], id);
    };

    const filterBlur: FocusEventHandler<HTMLInputElement> = () => {
        if (!hasFilterSearch) setIsFilterSearchOpen(false);
    };
    const fieldBlur: FocusEventHandler<HTMLInputElement> = () => {
        if (!hasFieldSearch) setIsFieldSearchOpen(false);
    };

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <Panel
                edges={['bottom']}
                defaultHeight={280}
                minHeight={180}
                maxHeight={520}
                className="flex min-h-45 flex-col rounded-none! border-b border-slate-200/80 bg-transparent dark:border-slate-800"
            >
                <section className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tag hierarchy</h3>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Structure the visible groups and inheritance tree.</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                aria-label="Add tag"
                                title={mutationDeniedReason ?? 'Add tag'}
                                disabled={!canMutate}
                                onClick={addFilter}
                                className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                            >
                                <VscNewFolder />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsFilterSearchOpen(true);
                                    queueMicrotask(() => filterSearchInputRef.current?.focus());
                                }}
                                className={`cursor-pointer rounded-lg p-2 ${isFilterSearchOpen || hasFilterSearch ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100'}`}
                            >
                                <CiSearch />
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                        {isFilterSearchOpen || hasFilterSearch ? (
                            <PanelSearch
                                ref={filterSearchInputRef}
                                value={filterSearch}
                                onChange={setFilterSearch}
                                placeholder="Search tags"
                                autoFocus
                                onBlur={filterBlur}
                            />
                        ) : null}
                        <ScrollArea className="min-h-0 flex-1 pr-1">
                            {filters.length ? (
                                <SortTree
                                    ref={filtersRef}
                                    nodeClassName="text-sm!"
                                    defaultNodeIcon={<LuTags />}
                                    selectionMode="multiple"
                                    selectedRowClassName="bg-blue-50! text-blue-700 dark:bg-blue-500/10! dark:text-blue-200"
                                    allSupportSubnodes
                                    onSelect={select}
                                    value={canvas.selection.filter_ids as string[]}
                                    rowClassName="mb-1 rounded-xl border border-transparent px-1 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900/70"
                                    data={filters}
                                    canDrag={() => canMutate}
                                    canDrop={(args) => canMutate && sameParentOnly(args)}
                                    activeClassName={(event) =>
                                        event.node.id === canvas.active_id
                                            ? 'border-blue-300! bg-blue-50/80 dark:border-blue-500/40! dark:bg-blue-500/10!'
                                            : ''
                                    }
                                    onChange={changeFilter}
                                />
                            ) : (
                                <EmptyState title="No tags match" description="Try a different search or create a new tag branch." />
                            )}
                        </ScrollArea>
                    </div>
                </section>
            </Panel>
            <section className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fields in view</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{`Under ${contextFilter?.label ?? 'Root'}`}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setIsFieldSearchOpen(true);
                                queueMicrotask(() => fieldSearchInputRef.current?.focus());
                            }}
                            className={`cursor-pointer rounded-lg p-2 ${isFieldSearchOpen || hasFieldSearch ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100'}`}
                        >
                            <CiSearch />
                        </button>
                        <button
                            type="button"
                            aria-label="Add option"
                            title={mutationDeniedReason ?? 'Add option'}
                            disabled={!canMutate}
                            onClick={addOption}
                            className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                        >
                            <FolderPlus className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Add field"
                            title={mutationDeniedReason ?? 'Add field'}
                            disabled={!canMutate}
                            onClick={addField}
                            className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                        >
                            <MdOutlineAdd />
                        </button>
                    </div>
                </div>
                <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                    {isFieldSearchOpen || hasFieldSearch ? (
                        <PanelSearch
                            ref={fieldSearchInputRef}
                            value={fieldSearch}
                            onChange={setFieldSearch}
                            placeholder="Search fields or options"
                            autoFocus
                            onBlur={fieldBlur}
                        />
                    ) : null}
                    <ScrollArea className="min-h-0 flex-1 pr-1">
                        {fields.length ? (
                            <SortTree
                                ref={fieldsRef}
                                nodeClassName="text-[13px]! font-medium"
                                defaultNodeIcon={(node) =>
                                    canvas.graph.nodes.find((candidate) => candidate.id === String(node.id))?.kind === 'option' ? (
                                        <BsXDiamondFill />
                                    ) : (
                                        <RxInput />
                                    )
                                }
                                selectionMode="multiple"
                                selectedRowClassName="bg-blue-50! text-blue-700 dark:bg-blue-500/10! dark:text-blue-200"
                                allSupportSubnodes
                                onSelect={select}
                                value={[...canvas.selection.field_ids, ...canvas.selection.option_ids] as string[]}
                                rowClassName="mb-1 rounded-xl border border-transparent px-1 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900/70"
                                data={fields}
                                canDrag={() => canMutate}
                                canDrop={(args) => canMutate && sameParentOnly(args)}
                                onChange={changeField}
                                activeClassName={(event) =>
                                    event.node.id === canvas.active_id
                                        ? 'border-blue-300! bg-blue-50/80 dark:border-blue-500/40! dark:bg-blue-500/10!'
                                        : ''
                                }
                            />
                        ) : (
                            <EmptyState title="No fields match" description="Use a broader search or add a new field under the selected tag." />
                        )}
                    </ScrollArea>
                </div>
            </section>
        </div>
    );
}
