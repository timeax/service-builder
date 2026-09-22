import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import { InputField } from '@timeax/form-palette';
import { type ReactNode, useEffect, useState } from 'react';
import { FaFolderOpen } from 'react-icons/fa';
import { FiEdit2, FiFolderPlus, FiPlus, FiTrash2 } from 'react-icons/fi';

const UNGROUPED_TREE_VALUE = '__catalog_ungrouped__';
export type CatalogGroupView = { id: string; label: string; parentId?: string | null; order?: number; serviceIds: Array<string | number> };

export function CatalogToolbar({
    groups,
    selectedGroupId,
    selectedGroupLabel,
    ungroupedSelected,
    disabled = false,
    disabledReason,
    onSelectGroup,
    onCreateRootGroup,
    onCreateChildGroup,
    onRenameGroup,
    onDeleteGroup,
    onAssignServices,
}: {
    groups: CatalogGroupView[];
    selectedGroupId: string | null;
    selectedGroupLabel: string | null;
    ungroupedSelected: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onSelectGroup(groupId: string | null): void;
    onCreateRootGroup(label: string): void;
    onCreateChildGroup(label: string): void;
    onRenameGroup(label: string): void;
    onDeleteGroup(): void;
    onAssignServices(): void;
}) {
    const treeValue = selectedGroupId ?? (ungroupedSelected ? UNGROUPED_TREE_VALUE : undefined);
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <GroupInput
                    label="Create top-level group"
                    icon={<FiPlus />}
                    submitLabel="Create"
                    title="Create root group"
                    disabled={disabled}
                    disabledTitle={disabledReason}
                    onSubmit={onCreateRootGroup}
                />
                <GroupInput
                    label="Create child group"
                    icon={<FiFolderPlus />}
                    submitLabel="Create"
                    title="Create child group"
                    disabled={disabled || !selectedGroupId}
                    disabledTitle={disabledReason}
                    onSubmit={onCreateChildGroup}
                />
                <GroupInput
                    label="Rename selected group"
                    icon={<FiEdit2 />}
                    submitLabel="Save"
                    title="Rename group"
                    disabled={disabled || !selectedGroupId}
                    disabledTitle={disabledReason}
                    initialValue={selectedGroupLabel ?? ''}
                    onSubmit={onRenameGroup}
                />
                <ConfirmButton
                    label="Delete selected group"
                    icon={<FiTrash2 />}
                    title="Delete group?"
                    description={
                        selectedGroupLabel ? `Remove ${selectedGroupLabel} and its child groups.` : 'Remove this group and its child groups.'
                    }
                    disabled={disabled || !selectedGroupId}
                    disabledTitle={disabledReason}
                    onConfirm={onDeleteGroup}
                />
                <IconButton
                    label="Assign services to selected group"
                    disabled={disabled || !selectedGroupId}
                    disabledTitle={disabledReason}
                    onClick={onAssignServices}
                >
                    <FiPlus />
                </IconButton>
            </div>
            <InputField
                variant="treeselect"
                mode="button"
                label="Catalog group selector"
                className="w-fit!"
                multiple={false}
                value={treeValue}
                options={[{ key: UNGROUPED_TREE_VALUE, label: 'Ungrouped' }, ...treeOptions(groups)] as never}
                searchable
                clearable
                onChange={({ value }) => {
                    const next = value == null ? null : String(value);
                    onSelectGroup(next === UNGROUPED_TREE_VALUE ? null : next);
                }}
                button={<FaFolderOpen />}
            />
        </div>
    );
}

function BaseIconButton({
    label,
    icon,
    disabled,
    disabledTitle,
    onClick,
}: {
    label: string;
    icon: ReactNode;
    disabled?: boolean;
    disabledTitle?: string;
    onClick?(): void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            title={disabled && disabledTitle ? disabledTitle : label}
            className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition',
                disabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
            )}
        >
            {icon}
        </button>
    );
}

function GroupInput({
    icon,
    label,
    title,
    submitLabel,
    initialValue = '',
    disabled,
    disabledTitle,
    onSubmit,
}: {
    icon: ReactNode;
    label: string;
    title: string;
    submitLabel: string;
    initialValue?: string;
    disabled?: boolean;
    disabledTitle?: string;
    onSubmit(label: string): void;
}) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        if (open) setValue(initialValue);
    }, [initialValue, open]);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <BaseIconButton label={label} icon={icon} disabled={disabled} disabledTitle={disabledTitle} />
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
                        onChange={({ value: next }) => setValue(String(next ?? ''))}
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
                                if (next) {
                                    onSubmit(next);
                                    setOpen(false);
                                }
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

function ConfirmButton({
    icon,
    label,
    title,
    description,
    disabled,
    disabledTitle,
    onConfirm,
}: {
    icon: ReactNode;
    label: string;
    title: string;
    description: string;
    disabled?: boolean;
    disabledTitle?: string;
    onConfirm(): void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <BaseIconButton label={label} icon={icon} disabled={disabled} disabledTitle={disabledTitle} />
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
                            Delete
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function IconButton({ children, label, disabled, disabledTitle, onClick }: { children: ReactNode; label: string; disabled?: boolean; disabledTitle?: string; onClick(): void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <BaseIconButton label={label} icon={children} disabled={disabled} disabledTitle={disabledTitle} onClick={onClick} />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}

function treeOptions(groups: CatalogGroupView[], parentId: string | null = null): Array<Record<string, unknown>> {
    return groups
        .filter((group) => (group.parentId ?? null) === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))
        .map((group) => {
            const children = treeOptions(groups, group.id);
            return {
                key: group.id,
                label: group.label,
                description: `${group.serviceIds.length} service${group.serviceIds.length === 1 ? '' : 's'}`,
                children: children.length ? children : undefined,
            };
        });
}
