import type { BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import type { ServiceContextSnapshot, ServiceContextState, ServiceListRowVM } from '@/builder/service-context.ts';
import { EmptyState, StatusDot } from '@/components/builder/index.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import type { CatalogGroupNode } from '@timeax/digital-service-engine/schema';
import { InputField } from '@timeax/form-palette';
import { type DragEvent, type ReactNode, useEffect, useState } from 'react';
import { FaFolderOpen } from 'react-icons/fa';
import { FiEdit2, FiFilter, FiFolderPlus, FiPlus, FiTrash2 } from 'react-icons/fi';
import { ServiceDetailCard } from './service-detail-card.tsx';
import { filterChipClassName, statusBadgeClassName } from './utils.tsx';

const UNGROUPED_TREE_VALUE = '__catalog_ungrouped__';

type ServicesSplitPaneProps = {
    mode: 'active' | 'all' | 'catalog';
    rows: ServiceListRowVM[];
    selectedRowId: string | null;
    onSelectRow: (id: string | null) => void;
    detailRow: ServiceListRowVM | null;
    onNodeClick: (nodeId: string) => void;
    onOpenFallbackQuickAdd?: (service: BuilderServiceSummary) => void;
    onOpenFallbackEditor?: (service: BuilderServiceSummary) => void;
    search: string;
    onSearchChange: (value: string) => void;
    appliedSnapshot?: ServiceContextSnapshot;
    draftSnapshot?: ServiceContextSnapshot;
    contextLinked?: boolean;
    compatibleOnly?: boolean;
    filterOpen?: boolean;
    onFilterOpenChange?: (open: boolean) => void;
    onCompatibleOnlyChange?: (value: boolean) => void;
    onContextLinkedChange?: (value: boolean) => void;
    draftContext?: ServiceContextState;
    onDraftContextChange?: (value: ServiceContextState) => void;
    onRowDragStart?: (serviceId: string, event: DragEvent<HTMLButtonElement>) => void;
    onRowDragEnd?: () => void;
    catalogGroups?: CatalogGroupNode[];
    catalogExpandedIds?: string[];
    catalogActiveGroupId?: string | null;
    catalogUngrouped?: boolean;
    onCatalogSelectGroup?: (groupId: string | null) => void;
    onCatalogToggleGroupExpanded?: (groupId: string, expanded: boolean) => void;
    selectedCatalogGroupLabel?: string | null;
    onCatalogCreateRootGroup?: (label: string) => void;
    onCatalogCreateChildGroup?: (label: string) => void;
    onCatalogRenameGroup?: (label: string) => void;
    onCatalogDeleteGroup?: () => void;
    onCatalogAssignServices?: () => void;
};

export function ServicesSplitPane(props: ServicesSplitPaneProps) {
    const emptyTitle = props.mode === 'active' ? 'No active services yet' : 'No services match this view';
    const emptyDescription =
        props.mode === 'active'
            ? 'Connect a service to a tag, field, or option and it will appear here with its bindings.'
            : props.mode === 'catalog'
              ? 'Select a catalog group or create one to organize source services for faster assignment.'
              : 'Try changing the search or toggles to bring more services into view.';

    return (
        <div className="min-h-90 p-4">
            <ResizablePanelGroup direction="horizontal" className="min-h-90">
                <ResizablePanel defaultSize={44} minSize={30}>
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="space-y-3 border-b border-slate-100 pr-4 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                                        {props.mode === 'active'
                                            ? 'Attached services'
                                            : props.mode === 'catalog'
                                              ? 'Catalog workspace'
                                              : 'All services'}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                    {props.mode === 'catalog' ? (
                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-blue-700 uppercase dark:bg-blue-500/10 dark:text-blue-200">
                                            {props.selectedCatalogGroupLabel ?? 'Ungrouped'}
                                        </span>
                                    ) : null}
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:bg-slate-900 dark:text-slate-300">
                                        {props.rows.length}
                                    </span>
                                </div>
                            </div>

                            {props.mode === 'all' && props.appliedSnapshot?.selectedTag ? (
                                <div className="flex flex-wrap gap-2 pb-3">
                                    <FilterChip label={`Context tag: ${props.appliedSnapshot.selectedTag.label}`} />
                                    <FilterChip
                                        label={`${props.appliedSnapshot.state.selectedButtons.length} selected trigger${props.appliedSnapshot.state.selectedButtons.length === 1 ? '' : 's'}`}
                                    />
                                    <FilterChip
                                        label={`${props.appliedSnapshot.usedServiceIds.length} active service${props.appliedSnapshot.usedServiceIds.length === 1 ? '' : 's'} in context`}
                                    />
                                </div>
                            ) : null}

                            {props.mode === 'catalog' ? (
                                <div className="space-y-3 pb-3">
                                    <CatalogToolbar
                                        groups={props.catalogGroups ?? []}
                                        selectedGroupId={props.catalogActiveGroupId ?? null}
                                        selectedGroupLabel={props.selectedCatalogGroupLabel ?? null}
                                        ungroupedSelected={props.catalogUngrouped ?? false}
                                        onSelectGroup={props.onCatalogSelectGroup ?? (() => {})}
                                        onCreateRootGroup={props.onCatalogCreateRootGroup ?? (() => {})}
                                        onCreateChildGroup={props.onCatalogCreateChildGroup ?? (() => {})}
                                        onRenameGroup={props.onCatalogRenameGroup ?? (() => {})}
                                        onDeleteGroup={props.onCatalogDeleteGroup ?? (() => {})}
                                        onAssignServices={props.onCatalogAssignServices ?? (() => {})}
                                    />
                                </div>
                            ) : null}
                        </div>

                        <ScrollArea className="h-[calc(var(--bottom-panel-height)-15rem)] max-h-[calc(var(--bottom-panel-height)-15rem)] min-h-0 flex-1">
                            <div className="space-y-2 p-3 pl-0">
                                {props.rows.length === 0 ? (
                                    <EmptyState title={emptyTitle} description={emptyDescription} />
                                ) : (
                                    props.rows.map((row) => (
                                        <button
                                            key={row.id}
                                            type="button"
                                            draggable={props.mode !== 'active'}
                                            onClick={() => props.onSelectRow(row.id)}
                                            onDragStart={(event) => props.onRowDragStart?.(row.id, event)}
                                            onDragEnd={props.onRowDragEnd}
                                            className={cn(
                                                'w-full rounded-2xl border px-4 py-3 text-left transition',
                                                props.selectedRowId === row.id
                                                    ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700',
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <StatusDot tone={row.statusTone} />
                                                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                            {row.summary.name}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                        <span>#{row.summary.id}</span>
                                                        {row.summary.category ? <span>{row.summary.category}</span> : null}
                                                        {row.summary.platformId ? <span>{row.summary.platformId}</span> : null}
                                                    </div>
                                                </div>
                                                <span className={statusBadgeClassName(row.statusTone)}>{row.statusLabel}</span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                    {row.summary.attachmentCount} node{row.summary.attachmentCount === 1 ? '' : 's'}
                                                </span>
                                                {row.summary.rate != null ? (
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                        Rate {row.summary.rate}
                                                    </span>
                                                ) : null}
                                                {row.reasonLabels.slice(0, 2).map((reason) => (
                                                    <span
                                                        key={`${row.id}:${reason}`}
                                                        className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                                                    >
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </section>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={56} minSize={36}>
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                        <div className="border-b border-slate-100 px-4 dark:border-slate-800">
                            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase dark:text-slate-500">Service detail</p>
                            <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                                {props.detailRow ? props.detailRow.summary.name : 'Select a service'}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {props.mode === 'active'
                                    ? 'Highlight connected nodes, inspect usage, and jump back into the canvas.'
                                    : props.mode === 'catalog'
                                      ? 'Inspect compatibility, pricing, and bindings while browsing manual catalog groups.'
                                      : 'Inspect compatibility, pricing, and bindings before assigning the service to a node.'}
                            </p>
                        </div>

                        <ScrollArea className="h-[calc(var(--bottom-panel-height)-15rem)] min-h-0 flex-1">
                            <div className="p-5">
                                {props.detailRow ? (
                                    <ServiceDetailCard
                                        mode={props.mode}
                                        row={props.detailRow}
                                        snapshot={props.appliedSnapshot ?? null}
                                        onNodeClick={props.onNodeClick}
                                        onOpenFallbackQuickAdd={props.onOpenFallbackQuickAdd}
                                        onOpenFallbackEditor={props.onOpenFallbackEditor}
                                    />
                                ) : (
                                    <EmptyState
                                        title="No service selected"
                                        description={
                                            props.mode === 'active'
                                                ? 'Choose a connected service from the list to see its bindings.'
                                                : props.mode === 'catalog'
                                                  ? 'Pick a service from the selected catalog group to inspect its current visible-group fit.'
                                                  : 'Pick a service to inspect how it fits the current visible-group context.'
                                        }
                                    />
                                )}
                            </div>
                        </ScrollArea>
                    </section>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

export function CatalogContextPopover({
    open,
    onOpenChange,
    compatibleOnly,
    onCompatibleOnlyChange,
    contextLinked,
    onContextLinkedChange,
    draftContext,
    draftSnapshot,
    onDraftContextChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    compatibleOnly: boolean;
    onCompatibleOnlyChange: (value: boolean) => void;
    contextLinked: boolean;
    onContextLinkedChange: (value: boolean) => void;
    draftContext?: ServiceContextState;
    draftSnapshot?: ServiceContextSnapshot;
    onDraftContextChange: (value: ServiceContextState) => void;
}) {
    const context = draftContext;
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Catalog context filter"
                    className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                        compatibleOnly
                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                >
                    <FiFilter />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
            >
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Catalog context</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Control compatibility checks here, or link them to the current workspace context.
                    </p>
                </div>
                <ScrollArea className="h-[calc(var(--radix-popover-content-available-height)-4.5rem)] max-h-[calc(var(--radix-popover-content-available-height)-4.5rem)]">
                    <div className="space-y-4 p-4">
                        <label className="flex items-start justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                            <span className="min-w-0">
                                <span className="block font-medium">Compatible only</span>
                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                    Show only services that fit this catalog context safely.
                                </span>
                            </span>
                            <input type="checkbox" checked={compatibleOnly} onChange={(event) => onCompatibleOnlyChange(event.target.checked)} />
                        </label>
                        <label className="flex items-start justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                            <span className="min-w-0">
                                <span className="block font-medium">Link to current context</span>
                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                    Mirror the current canvas tag and selected buttons while linked.
                                </span>
                            </span>
                            <input type="checkbox" checked={contextLinked} onChange={(event) => onContextLinkedChange(event.target.checked)} />
                        </label>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Tags</div>
                            <div className="space-y-2">
                                {(draftSnapshot?.tags ?? []).map((tag) => {
                                    const selected = context?.selectedTagId === tag.id;
                                    return (
                                        <label key={tag.id} className="flex items-start gap-3 text-sm text-slate-900 dark:text-slate-100">
                                            <input
                                                type="radio"
                                                disabled={contextLinked}
                                                checked={selected}
                                                onChange={() =>
                                                    onDraftContextChange({
                                                        ...(context ?? {
                                                            selectedTagId: null,
                                                            selectedButtons: [],
                                                            strictSafety: true,
                                                            enforcePolicies: true,
                                                        }),
                                                        selectedTagId: tag.id,
                                                        selectedButtons: [],
                                                    })
                                                }
                                            />
                                            <span className="min-w-0">
                                                <span className="block font-medium">{tag.label}</span>
                                                {tag.description ? (
                                                    <span className="block text-xs text-slate-500 dark:text-slate-400">{tag.description}</span>
                                                ) : null}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                                Selected buttons
                            </div>
                            {draftSnapshot?.buttonGroups?.length ? (
                                <div className="space-y-3">
                                    {draftSnapshot.buttonGroups.map((group) => (
                                        <div key={group.id} className="space-y-2">
                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{group.label}</div>
                                            <div className="space-y-1">
                                                {group.options.map((option) => {
                                                    const checked = context?.selectedButtons.includes(option.id) ?? false;
                                                    return (
                                                        <label
                                                            key={option.id}
                                                            className="flex items-start gap-3 text-sm text-slate-900 dark:text-slate-100"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                disabled={contextLinked}
                                                                checked={checked}
                                                                onChange={() =>
                                                                    onDraftContextChange({
                                                                        ...(context ?? {
                                                                            selectedTagId: null,
                                                                            selectedButtons: [],
                                                                            strictSafety: true,
                                                                            enforcePolicies: true,
                                                                        }),
                                                                        selectedButtons: checked
                                                                            ? (context?.selectedButtons ?? []).filter((id) => id !== option.id)
                                                                            : [...(context?.selectedButtons ?? []), option.id],
                                                                    })
                                                                }
                                                            />
                                                            <span className="min-w-0">
                                                                <span className="block">{option.label}</span>
                                                                {option.description ? (
                                                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                                        {option.description}
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 dark:text-slate-400">No visible trigger options for the selected tag.</div>
                            )}
                        </div>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                            <div className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Safety</div>
                            <label className="flex items-center justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                                <span>Strict safety</span>
                                <input
                                    type="checkbox"
                                    disabled={contextLinked}
                                    checked={context?.strictSafety ?? true}
                                    onChange={(event) =>
                                        onDraftContextChange({
                                            ...(context ?? { selectedTagId: null, selectedButtons: [], strictSafety: true, enforcePolicies: true }),
                                            strictSafety: event.target.checked,
                                        })
                                    }
                                />
                            </label>
                            <label className="flex items-center justify-between gap-3 text-sm text-slate-900 dark:text-slate-100">
                                <span>Enforce policies</span>
                                <input
                                    type="checkbox"
                                    disabled={contextLinked}
                                    checked={context?.enforcePolicies ?? true}
                                    onChange={(event) =>
                                        onDraftContextChange({
                                            ...(context ?? { selectedTagId: null, selectedButtons: [], strictSafety: true, enforcePolicies: true }),
                                            enforcePolicies: event.target.checked,
                                        })
                                    }
                                />
                            </label>
                        </div>
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

function CatalogToolbar({
    groups,
    selectedGroupId,
    selectedGroupLabel,
    ungroupedSelected,
    onSelectGroup,
    onCreateRootGroup,
    onCreateChildGroup,
    onRenameGroup,
    onDeleteGroup,
    onAssignServices,
}: {
    groups: CatalogGroupNode[];
    selectedGroupId: string | null;
    selectedGroupLabel: string | null;
    ungroupedSelected: boolean;
    onSelectGroup: (groupId: string | null) => void;
    onCreateRootGroup: (label: string) => void;
    onCreateChildGroup: (label: string) => void;
    onRenameGroup: (label: string) => void;
    onDeleteGroup: () => void;
    onAssignServices: () => void;
}) {
    const treeValue = selectedGroupId ?? (ungroupedSelected ? UNGROUPED_TREE_VALUE : undefined);
    const treeOptions = buildCatalogGroupTreeOptions(groups);

    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <GroupInputPopoverButton
                    label="Create top-level group"
                    icon={<FiPlus />}
                    submitLabel="Create"
                    title="Create root group"
                    onSubmit={onCreateRootGroup}
                />
                <GroupInputPopoverButton
                    label="Create child group"
                    icon={<FiFolderPlus />}
                    title="Create child group"
                    submitLabel="Create"
                    disabled={!selectedGroupId}
                    onSubmit={onCreateChildGroup}
                />
                <GroupInputPopoverButton
                    label="Rename selected group"
                    icon={<FiEdit2 />}
                    title="Rename group"
                    submitLabel="Save"
                    disabled={!selectedGroupId}
                    initialValue={selectedGroupLabel ?? ''}
                    onSubmit={onRenameGroup}
                />
                <ConfirmPopoverButton
                    label="Delete selected group"
                    icon={<FiTrash2 />}
                    title="Delete group?"
                    description={
                        selectedGroupLabel ? `Remove ${selectedGroupLabel} and its child groups.` : 'Remove this group and its child groups.'
                    }
                    confirmLabel="Delete"
                    disabled={!selectedGroupId}
                    onConfirm={onDeleteGroup}
                />
                <ToolbarIconButton label="Assign services to selected group" disabled={!selectedGroupId} onClick={onAssignServices}>
                    <FiPlus />
                </ToolbarIconButton>
            </div>
            <InputField
                variant="treeselect"
                mode="button"
                label="Catalog group selector"
                className={'w-fit!'}
                multiple={false}
                value={treeValue}
                options={[{ key: UNGROUPED_TREE_VALUE, label: 'Ungrouped' }, ...treeOptions] as any}
                searchable
                clearable
                onChange={(event) => {
                    const next = event.value == null ? null : String(event.value);
                    onSelectGroup(next === UNGROUPED_TREE_VALUE ? null : next);
                }}
                button={<FaFolderOpen />}
            />
        </div>
    );
}

function GroupInputPopoverButton({
    icon,
    label,
    title,
    submitLabel,
    initialValue = '',
    disabled = false,
    onSubmit,
}: {
    icon: ReactNode;
    label: string;
    title: string;
    submitLabel: string;
    initialValue?: string;
    disabled?: boolean;
    onSubmit: (label: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (open) setValue(initialValue);
    }, [initialValue, open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={label}
                    title={label}
                    className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                        disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                >
                    {icon}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" sideOffset={8} collisionPadding={16} className="w-80 rounded-2xl">
                <div className="space-y-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Names are editor-side catalog labels only.</p>
                    </div>
                    <InputField
                        variant="text"
                        label={title}
                        value={value}
                        onChange={(event) => setValue(String(event.value ?? ''))}
                        placeholder="Group name"
                        autoComplete="off"
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!value.trim()}
                            onClick={() => {
                                const next = value.trim();
                                if (!next) return;
                                onSubmit(next);
                                setOpen(false);
                            }}
                            className="rounded-xl"
                        >
                            {submitLabel}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function ConfirmPopoverButton({
    icon,
    label,
    title,
    description,
    confirmLabel,
    disabled = false,
    onConfirm,
}: {
    icon: ReactNode;
    label: string;
    title: string;
    description: string;
    confirmLabel: string;
    disabled?: boolean;
    onConfirm: () => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={label}
                    title={label}
                    className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                        disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                >
                    {icon}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" sideOffset={8} collisionPadding={16} className="w-80 rounded-2xl">
                <div className="space-y-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                onConfirm();
                                setOpen(false);
                            }}
                            className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function ToolbarIconButton({
    children,
    label,
    disabled = false,
    onClick,
}: {
    children: ReactNode;
    label: string;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={onClick}
                    aria-label={label}
                    className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                        disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                >
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}

function FilterChip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
    return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', filterChipClassName(tone))}>{label}</span>;
}

function buildCatalogGroupTreeOptions(groups: CatalogGroupNode[], parentId: string | null = null): Array<Record<string, unknown>> {
    return groups
        .filter((group) => (group.parentId ?? null) === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))
        .map((group) => {
            const children = buildCatalogGroupTreeOptions(groups, group.id);
            return {
                key: group.id,
                label: group.label,
                description: `${group.serviceIds.length} service${group.serviceIds.length === 1 ? '' : 's'}`,
                children: children.length ? children : undefined,
            };
        });
}
