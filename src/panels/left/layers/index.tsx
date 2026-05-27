import { useNodeContextMenu } from '@/builder/node-context-menu.tsx';
import { buildFieldId } from '@/builder/node-context/utils.ts';
import { EmptyState, PanelSearch } from '@/components/builder/index.tsx';
import { SortTree, type SortTreeProps, type TreeNode } from '@/components/sort-tree';
import type { SortTreeRef } from '@/components/sort-tree/types.ts';
import { Panel } from '@/components/ui/panel.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import {
    resolveFieldOptionCapability,
    shouldBlockOptionCreation
} from '@/panels/right/partials/properties/components/descriptor-options.ts';
import { useInputs } from '@timeax/digital-service-engine/react';
import type { Field, FieldOption, Tag } from '@timeax/digital-service-engine/schema';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { type FocusEventHandler, useMemo, useRef, useState } from 'react';
import { BsXDiamondFill } from 'react-icons/bs';
import { CiSearch } from 'react-icons/ci';
import { LuTags } from 'react-icons/lu';
import { MdOutlineAdd } from 'react-icons/md';
import { RxInput } from 'react-icons/rx';
import { VscNewFolder } from 'react-icons/vsc';
import {
    applyFieldTreeReorder,
    applyTagTreeReorder,
    canDropFieldsSameParentOnly,
    canDropSameParentOnly
} from './reorder.ts';

function filterTree<T>(nodes: Array<TreeNode<T>>, query: string): Array<TreeNode<T>> {
    if (!query.trim()) return nodes;
    const lower = query.toLowerCase();

    return nodes
        .map((node) => {
            const children = node.children ? filterTree(node.children as Array<TreeNode<T>>, query) : [];
            if (node.title.toLowerCase().includes(lower) || children.length) {
                return {
                    ...node,
                    expanded: true,
                    children,
                };
            }

            return null;
        })
        .filter(Boolean) as Array<TreeNode<T>>;
}

const Layers = () => {
    const canvas = useCanvas();
    const { registry } = useInputs();
    const { openNodeContextMenu, canAcceptDropPayload, handleNodeDrop } = useNodeContextMenu();
    const tagsRef = useRef<SortTreeRef<Tag>>(null);
    const fieldsRef = useRef<SortTreeRef<Field>>(null);
    const tagSearchInputRef = useRef<HTMLInputElement>(null);
    const fieldSearchInputRef = useRef<HTMLInputElement>(null);

    const [tagSearch, setTagSearch] = useState('');
    const [fieldSearch, setFieldSearch] = useState('');
    const [isTagSearchOpen, setIsTagSearchOpen] = useState(false);
    const [isFieldSearchOpen, setIsFieldSearchOpen] = useState(false);

    const handleSelection: SortTreeProps['onSelect'] = (ids, meta) => {
        if (meta?.via === 'api') return;
        const primary = ids[0];
        if (!primary) return;

        canvas.setActive(primary);
        const cause = meta?.selection?.cause;
        if (cause === 'single' || cause === 'set') {
            canvas.api.select([primary]);
            return;
        }

        canvas.api.select(ids);
    };

    const resolveLayersContextTargets = (nodeId: string) => {
        const selected = Array.from(
            new Set(
                [
                    ...canvas.selection,
                    ...((canvas.selectionInfo.tagIds ?? []) as string[]),
                    ...((canvas.selectionInfo.fieldIds ?? []) as string[]),
                    ...((canvas.selectionInfo.optionIds ?? []) as string[]),
                    ...((canvas.selectionInfo.ids ?? []) as string[]),
                ]
                    .filter(Boolean)
                    .map(String),
            ),
        );
        if (selected.length > 1 && selected.includes(nodeId)) return selected;
        return [nodeId];
    };

    const handleTagChange: SortTreeProps<Tag>['onChange'] = (_next, detail) => {
        if (applyTagTreeReorder(detail as any, canvas.api.editor as any)) return;

        detail.preventDefault?.();

        if (detail.type === 'update') {
            canvas.api.editor.editLabel(detail.node.id as string, detail.node.title);
            return;
        }

        if (detail.type === 'insert' && detail.context.via === 'ui.create') {
            const parent = detail.to.parent.id;
            canvas.api.editor.addTag({ label: detail.node.title, bind_id: parent as any });
        }
    };

    const handleFieldChange: SortTreeProps<Field | FieldOption>['onChange'] = (_next, detail) => {
        if (
            applyFieldTreeReorder(detail as any, {
                editor: canvas.api.editor as any,
                currentTagId: canvas.api.selection.currentTag?.() ?? 't:root',
                contextFieldOrder: canvas.layers.fields.map((node) => String(node.id)).filter((id) => !id.startsWith('o:')),
            })
        ) {
            return;
        }

        if (detail.type === 'update') {
            detail.preventDefault();
            canvas.api.editor.editLabel(detail.node.id as string, detail.node.title);
        }

        if (detail.type === 'insert' && detail.context.via == 'ui.create') {
            const parent = detail.to.parent.id as string;
            const field = canvas.api.editor.getNode(parent)?.data;
            if (field && shouldBlockOptionCreation(registry, field as any)) {
                canvas.api.emit('error', {
                    message: 'This field type does not support options.',
                    meta: { action: 'add-option', fieldId: parent },
                });
                return;
            }
            canvas.api.editor.addOption(parent, { label: detail.node.title });
        }
    };

    const tags = useMemo(() => filterTree(canvas.layers.tags, tagSearch), [canvas.layers.tags, tagSearch]);
    const fields = useMemo(() => filterTree(canvas.layers.fields, fieldSearch), [canvas.layers.fields, fieldSearch]);

    const activeTagLabel = canvas.api.editor.getNode(canvas.api.selection.currentTag() ?? 't:root')?.data?.label ?? 'Root';
    const hasTagSearch = !!tagSearch.trim();
    const hasFieldSearch = !!fieldSearch.trim();

    const openTagSearch = () => {
        setIsTagSearchOpen(true);
        queueMicrotask(() => tagSearchInputRef.current?.focus());
    };

    const openFieldSearch = () => {
        setIsFieldSearchOpen(true);
        queueMicrotask(() => fieldSearchInputRef.current?.focus());
    };

    const handleTagSearchBlur: FocusEventHandler<HTMLInputElement> = () => {
        if (!tagSearch.trim()) setIsTagSearchOpen(false);
    };

    const handleFieldSearchBlur: FocusEventHandler<HTMLInputElement> = () => {
        if (!fieldSearch.trim()) setIsFieldSearchOpen(false);
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
                                onClick={() => tagsRef.current?.createUI(canvas.api.selection.currentTag() ?? 't:root')}
                                type="button"
                                className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                            >
                                <VscNewFolder />
                            </button>
                            <button
                                type="button"
                                onClick={openTagSearch}
                                className={`cursor-pointer rounded-lg p-2 ${
                                    isTagSearchOpen || hasTagSearch
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                                }`}
                            >
                                <CiSearch />
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                        {isTagSearchOpen || hasTagSearch ? (
                            <PanelSearch
                                ref={tagSearchInputRef}
                                value={tagSearch}
                                onChange={setTagSearch}
                                placeholder="Search tags"
                                autoFocus
                                onBlur={handleTagSearchBlur}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Escape') return;
                                    event.currentTarget.blur();
                                    if (!tagSearch.trim()) setIsTagSearchOpen(false);
                                }}
                            />
                        ) : null}
                        <ScrollArea className="min-h-0 flex-1 pr-1">
                            {tags.length ? (
                                <SortTree
                                    ref={tagsRef}
                                    nodeClassName="text-sm!"
                                    defaultNodeIcon={<LuTags />}
                                    selectionMode="multiple"
                                    selectedRowClassName="bg-blue-50! text-blue-700 dark:bg-blue-500/10! dark:text-blue-200"
                                    allSupportSubnodes
                                    onSelect={handleSelection}
                                    value={canvas.selectionInfo.tagIds as string[]}
                                    rowClassName="mb-1 rounded-xl border border-transparent px-1 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900/70"
                                    data={tags}
                                    canDrop={canDropSameParentOnly}
                                    activeClassName={(e) =>
                                        e.node.id === canvas.activeId
                                            ? 'border-blue-300! bg-blue-50/80 dark:border-blue-500/40! dark:bg-blue-500/10!'
                                            : ''
                                    }
                                    onChange={handleTagChange as any}
                                    onContextMenu={(detail) => {
                                        detail.event.preventDefault();
                                        const nodeId = String(detail.node.id);
                                        openNodeContextMenu({
                                            nodeId,
                                            nodeKind: 'tag',
                                            effectiveTargetIds: resolveLayersContextTargets(nodeId),
                                            surface: 'layers',
                                            clientX: detail.event.clientX,
                                            clientY: detail.event.clientY,
                                        });
                                    }}
                                    onExternalDrop={({ over, dataTransfer }) => {
                                        if (!canAcceptDropPayload(dataTransfer)) return;
                                        handleNodeDrop({
                                            receiverId: String(over.id),
                                            receiverKind: 'tag',
                                            surface: 'layers',
                                            clientX: 0,
                                            clientY: 0,
                                            dataTransfer,
                                        });
                                    }}
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
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{`Under ${activeTagLabel}`}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={openFieldSearch}
                            className={`cursor-pointer rounded-lg p-2 ${
                                isFieldSearchOpen || hasFieldSearch
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                            }`}
                        >
                            <CiSearch />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!fieldsRef.current) {
                                    const fieldId = buildFieldId();
                                    canvas.api.editor.addField({
                                        id: fieldId,
                                        label: 'New Field',
                                        type: 'text',
                                        bind_id: canvas.api.selection.currentTag() ?? 't:root',
                                    });
                                    const capability = resolveFieldOptionCapability(registry, { type: 'text' });
                                    if (capability.shouldAutoCreate) {
                                        canvas.api.editor.autoCreateOptionsMany([fieldId], () => ({
                                            label: capability.defaultLabel,
                                            value: capability.defaultValue,
                                        }));
                                    }
                                    return;
                                }
                                const selection = fieldsRef.current.getSelectionLocated?.() ?? [];

                                if (selection.length === 1) {
                                    const node = selection[0];
                                    const point = node?.path?.[0];

                                    fieldsRef.current.createUI(point);
                                    return;
                                }

                                const fieldId = buildFieldId();
                                canvas.api.editor.addField({
                                    id: fieldId,
                                    label: 'New Field',
                                    type: 'text',
                                    bind_id: canvas.api.selection.currentTag() ?? 't:root',
                                });
                                const capability = resolveFieldOptionCapability(registry, { type: 'text' });
                                if (capability.shouldAutoCreate) {
                                    canvas.api.editor.autoCreateOptionsMany([fieldId], () => ({
                                        label: capability.defaultLabel,
                                        value: capability.defaultValue,
                                    }));
                                }
                            }}
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
                            onBlur={handleFieldSearchBlur}
                            onKeyDown={(event) => {
                                if (event.key !== 'Escape') return;
                                event.currentTarget.blur();
                                if (!fieldSearch.trim()) setIsFieldSearchOpen(false);
                            }}
                        />
                    ) : null}
                    <ScrollArea className="min-h-0 flex-1 pr-1">
                        {fields.length ? (
                            <SortTree
                                nodeClassName="text-[13px]! font-medium"
                                defaultNodeIcon={(node) => {
                                    const id = String(node.id);
                                    //@ts-ignore
                                    if (id.startsWith('o:') || node.data?.meta?.button) return <BsXDiamondFill />;
                                    return <RxInput />;
                                }}
                                selectionMode="multiple"
                                selectedRowClassName="bg-blue-50! text-blue-700 dark:bg-blue-500/10! dark:text-blue-200"
                                ref={fieldsRef}
                                allSupportSubnodes
                                onSelect={(ids, meta) => {
                                    if (meta.via === 'api') return;
                                    const primary = ids[0];
                                    if (!primary) return;

                                    canvas.setActive(primary);
                                    const cause = meta.selection.cause;
                                    if (cause === 'single' || cause === 'set') {
                                        canvas.api.select([primary], primary);
                                        return;
                                    }

                                    canvas.api.select(ids, primary);
                                }}
                                value={[...canvas.selectionInfo.fieldIds, ...canvas.selectionInfo.optionIds] as string[]}
                                rowClassName="mb-1 rounded-xl border border-transparent px-1 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900/70"
                                data={fields}
                                canDrop={canDropFieldsSameParentOnly}
                                onChange={handleFieldChange as any}
                                onContextMenu={(detail) => {
                                    detail.event.preventDefault();
                                    const nodeId = String(detail.node.id);
                                    const resolvedKind = nodeId.startsWith('o:') ? 'option' : 'field';
                                    openNodeContextMenu({
                                        nodeId,
                                        nodeKind: resolvedKind,
                                        effectiveTargetIds: resolveLayersContextTargets(nodeId),
                                        surface: 'layers',
                                        clientX: detail.event.clientX,
                                        clientY: detail.event.clientY,
                                    });
                                }}
                                onExternalDrop={({ over, dataTransfer }) => {
                                    if (!canAcceptDropPayload(dataTransfer)) return;
                                    const receiverId = String(over.id);
                                    handleNodeDrop({
                                        receiverId,
                                        receiverKind: receiverId.startsWith('o:') ? 'option' : 'field',
                                        surface: 'layers',
                                        clientX: 0,
                                        clientY: 0,
                                        dataTransfer,
                                    });
                                }}
                                activeClassName={(e) =>
                                    e.node.id === canvas.activeId
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
};

export default Layers;
