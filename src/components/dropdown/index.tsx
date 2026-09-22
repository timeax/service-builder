import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import type {
    ActionItem,
    CheckboxItem,
    DropdownSize,
    GroupItem,
    LinkComponentType,
    LinkItem,
    MenuData,
    MenuNode,
    RadioGroupItem,
    RenderItemCtx,
    SubmenuItem,
    VisibilityCtx
} from './types';

/* ———————————————————————————————————————————————
 * Props
 * ——————————————————————————————————————————————— */

type DropdownProps = {
    /** Button/icon that toggles the menu (rendered via `asChild`) */
    trigger?: React.ReactNode;
    children?: React.ReactNode;
    /** Prime-like data source */
    menu: MenuData;

    /** Controlled/uncontrolled open-state and change handler */
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
    defaultOpen?: boolean;

    /** Minor spacing/height adjustments */
    size?: DropdownSize;

    /** Global default for closing after select (per-item can override) */
    closeOnSelect?: boolean; // default true

    /** Custom Link implementation for link items */
    LinkComponent?: LinkComponentType;

    /**
     * Key on the `LinkItem` that contains the destination. Default: "href".
     * For React Router, pass "to".
     */
    linkKey?: string;

    /** Extra className for the content panel */
    contentClassName?: string;

    /** Width behavior */
    matchTriggerWidth?: boolean;

    /** Scrolling behavior */
    maxHeight?: number | string; // e.g., 320 or '20rem'

    /** Placement & collision knobs */
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    sideOffset?: number;
    avoidCollisions?: boolean;
    collisionPadding?: number;

    /** Portal container (Radix portal) */
    container?: HTMLElement | null;

    /**
     * Global interior override for rows.
     * If it returns null/undefined, the default content is used.
     */
    renderItem?: (ctx: RenderItemCtx) => React.ReactNode;

    /**
     * Fires after an item completes its own `command`, across action/link/checkbox/radio.
     * (Not fired for submenu trigger focus.)
     */
    onItemSelect?: (args: { node: MenuNode; event: Event }) => void;

    /** Hover tracking (fires as the pointer moves across items) */
    onItemHover?: (node: MenuNode) => void;

    /** Telemetry hooks around command execution */
    onBeforeCommand?: (node: MenuNode) => void;
    onAfterCommand?: (node: MenuNode, result: unknown) => void;
    onCommandError?: (node: MenuNode, error: unknown) => void;

    /** Context object passed into `hiddenWhen` predicates */
    visibilityCtx?: VisibilityCtx;

    /** Custom header/separator renderers */
    renderGroupHeader?: (label?: React.ReactNode) => React.ReactNode;
    renderSeparator?: () => React.ReactNode;
};

/* ———————————————————————————————————————————————
 * Helpers
 * ——————————————————————————————————————————————— */

const IconNode: React.FC<{ icon?: MenuNode['icon']; className?: string }> = ({ icon, className }) => {
    if (!icon) return null;
    if (typeof icon === 'function') {
        const C = icon as React.ComponentType<{ className?: string }>;
        return <C className={cn('mr-2 size-4 shrink-0', className)} />;
    }
    return <span className={cn('mr-2 inline-flex items-center', className)}>{icon}</span>;
};

const RightSide: React.FC<{
    badge?: React.ReactNode;
    suffix?: React.ReactNode;
    shortcut?: string;
    loading?: boolean;
}> = ({ badge, suffix, shortcut, loading }) => {
    if (loading) {
        return <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />;
    }
    if (suffix) return <span className="ml-auto">{suffix}</span>;
    return (
        <>
            {badge ? <span className="ml-auto">{badge}</span> : null}
            {shortcut ? <span className="ml-2 text-xs text-muted-foreground tabular-nums">{shortcut}</span> : null}
        </>
    );
};

const rowClass = (size: DropdownSize, node: { danger?: boolean; className?: string }) =>
    cn(
        'cursor-default',
        size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2 text-md',
        node.danger ? ' text-destructive focus:bg-destructive/10 focus:text-destructive' : undefined,
        node.className,
    );

const rowClassIndicatorAware = (size: DropdownSize, node: { danger?: boolean; className?: string }) =>
    cn(
        'cursor-default',
        // Keep only y/text sizing so ui/dropdown-menu.tsx remains source of truth for left indicator gutter (`pl-8`).
        size === 'sm' ? 'py-1 text-sm' : 'py-2 text-md',
        node.danger ? ' text-destructive focus:bg-destructive/10 focus:text-destructive' : undefined,
        node.className,
    );

const isLink = (i: MenuNode): i is LinkItem => (i as LinkItem).type === 'link';
const isGroup = (i: MenuNode): i is GroupItem => (i as GroupItem).type === 'group';
const isSubmenu = (i: MenuNode): i is SubmenuItem => (i as SubmenuItem).type === 'submenu';
const isCheckbox = (i: MenuNode): i is CheckboxItem => (i as CheckboxItem).type === 'checkbox';
const isRadioGroup = (i: MenuNode): i is RadioGroupItem => (i as RadioGroupItem).type === 'radio-group';

/** Coalesce separators (remove leading/trailing/duplicates) within an array */
function tidySeparators(nodes: MenuNode[]): MenuNode[] {
    const out: MenuNode[] = [];
    let prevSep = true; // treat as if leading with sep to drop initial
    for (const n of nodes) {
        if (n.type === 'separator' || n.hidden) {
            if (!prevSep) {
                prevSep = true;
                out.push({ type: 'separator' });
            }
            continue;
        }
        out.push(n);
        prevSep = false;
    }
    // strip trailing sep
    while (out.length && out[out.length - 1].type === 'separator') out.pop();
    return out;
}

/** Fire item's command (supports async) + dropdown-level hooks */
async function runCommand(
    node: MenuNode,
    ev: Event,
    hooks: {
        onBeforeCommand?: (node: MenuNode) => void;
        onAfterCommand?: (node: MenuNode, result: unknown) => void;
        onCommandError?: (node: MenuNode, error: unknown) => void;
    },
    command?: ActionItem['command'] | LinkItem['command'],
) {
    try {
        hooks.onBeforeCommand?.(node);
        const invoke = command as ((input: { event: Event; item: MenuNode }) => void | Promise<unknown>) | undefined;
        const result = await (invoke?.({ event: ev, item: node }) ?? undefined);
        hooks.onAfterCommand?.(node, result);
        return result;
    } catch (err) {
        hooks.onCommandError?.(node, err);
        throw err;
    }
}

/** Keyboard shortcuts parsing & matching (global) */
type Hot = { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; key?: string };
function parseShortcut(s?: string): Hot | null {
    if (!s) return null;
    const norm = s.replace(/⌘/g, 'Meta+').replace(/⇧/g, 'Shift+').replace(/⌥/g, 'Alt+');
    const parts = norm
        .split('+')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
    const hot: Hot = {};
    for (const p of parts) {
        if (p === 'ctrl' || p === 'control') hot.ctrl = true;
        else if (p === 'alt' || p === 'option') hot.alt = true;
        else if (p === 'shift') hot.shift = true;
        else if (p === 'meta' || p === 'cmd' || p === 'command') hot.meta = true;
        else hot.key = p;
    }
    return hot;
}
function matchHot(ev: KeyboardEvent, hot: Hot): boolean {
    const key = (ev.key || '').toLowerCase();
    const modOk = !!hot.ctrl === ev.ctrlKey && !!hot.alt === ev.altKey && !!hot.shift === ev.shiftKey && !!hot.meta === ev.metaKey;
    const keyOk = !hot.key || hot.key === key;
    return modOk && keyOk;
}

/* ———————————————————————————————————————————————
 * Component
 * ——————————————————————————————————————————————— */

export const Dropdown: React.FC<DropdownProps> = ({
    trigger,
    children = trigger,
    menu,
    onOpenChange,
    open,
    defaultOpen,
    size = 'md',
    closeOnSelect = true,
    LinkComponent,
    linkKey = 'href',
    contentClassName,
    matchTriggerWidth,
    maxHeight = 320,
    side = 'bottom',
    align = 'start',
    sideOffset = 6,
    avoidCollisions,
    collisionPadding,
    container,
    renderItem,
    onItemSelect,
    onItemHover,
    onBeforeCommand,
    onAfterCommand,
    onCommandError,
    visibilityCtx,
    renderGroupHeader,
    renderSeparator,
}) => {
    /** Track per-item loading for async commands */
    const [loadingIds, setLoadingIds] = React.useState<Set<string | number>>(new Set());
    const setLoading = (id?: string | number, state?: boolean) => {
        if (id == null) return;
        setLoadingIds((prev) => {
            const next = new Set(prev);
            if (state) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    /** Confirm dialog state */
    const [confirmNode, setConfirmNode] = React.useState<MenuNode | null>(null);
    const [confirmEvent, setConfirmEvent] = React.useState<Event | null>(null);

    /** Visibility filtering + separator tidy (deep) */
    const filterTree = React.useCallback(
        (nodes: MenuNode[]): MenuNode[] => {
            const visible = nodes.filter((n) => {
                if ('hidden' in n && n.hidden) return false;
                if ('visible' in n && n.visible === false) return false;
                if ('hiddenWhen' in n && typeof n.hiddenWhen === 'function') {
                    return !n.hiddenWhen(visibilityCtx ?? {});
                }
                return true;
            });
            const mapped = visible.map((n) => {
                if (isGroup(n) || isSubmenu(n)) {
                    const items = filterTree(n.items ?? []);
                    return { ...n, items } as MenuNode;
                }
                if (isRadioGroup(n)) {
                    const items = n.items.filter((item) => {
                        if (item.hidden || item.visible === false) return false;
                        return !item.hiddenWhen?.(visibilityCtx ?? {});
                    });
                    return { ...n, items };
                }
                return n;
            });
            return tidySeparators(mapped);
        },
        [visibilityCtx],
    );

    const prunedMenu = React.useMemo(() => filterTree(menu), [menu, filterTree]);

    /** Flatten visible items for global hotkeys */
    const flat = React.useMemo(() => {
        const acc: MenuNode[] = [];
        const walk = (nodes: MenuNode[]) => {
            for (const n of nodes) {
                if (isGroup(n) || isSubmenu(n) || isRadioGroup(n)) {
                    walk(((n as GroupItem | SubmenuItem | RadioGroupItem).items ?? []) as MenuNode[]);
                } else {
                    acc.push(n);
                }
            }
        };
        walk(prunedMenu);
        return acc;
    }, [prunedMenu]);

    /** Global hotkey binding (as requested) */
    React.useEffect(() => {
        const bindings = flat.map((n) => ({ n, hot: parseShortcut('shortcut' in n ? n.shortcut : undefined) })).filter((x) => x.hot);

        if (!bindings.length) return;

        const onKey = async (ev: KeyboardEvent) => {
            for (const { n, hot } of bindings) {
                if (!hot) continue;
                if (matchHot(ev, hot)) {
                    if ('disabled' in n && n.disabled) return;
                    ev.preventDefault();

                    // Checkbox toggles
                    if (isCheckbox(n)) {
                        const c = n as CheckboxItem;
                        const next = !c.checked;
                        try {
                            setLoading(n.id, true);
                            await c.onCheckedChange?.(next);
                            onItemSelect?.({ node: n, event: ev as unknown as Event });
                        } finally {
                            setLoading(n.id, false);
                        }
                        return;
                    }

                    // Link fallback navigation (native)
                    if (isLink(n)) {
                        setLoading(n.id, true);
                        try {
                            await runCommand(n, ev as unknown as Event, { onBeforeCommand, onAfterCommand, onCommandError }, n.command);
                            const dest = (n as Record<string, unknown>)[linkKey];
                            if (typeof dest === 'string') window.location.assign(dest);
                            onItemSelect?.({ node: n, event: ev as unknown as Event });
                        } finally {
                            setLoading(n.id, false);
                        }
                        return;
                    }

                    // Default actions
                    const a = n as ActionItem;
                    setLoading(n.id, true);
                    try {
                        await runCommand(a, ev as unknown as Event, { onBeforeCommand, onAfterCommand, onCommandError }, a.command);
                        onItemSelect?.({ node: a, event: ev as unknown as Event });
                    } finally {
                        setLoading(n.id, false);
                    }
                    return;
                }
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [flat, onItemSelect, linkKey, onBeforeCommand, onAfterCommand, onCommandError]);

    /** Handle row selection (close/open behavior and confirms) */
    const handleSelect = async (node: MenuNode, ev: Event, commit: () => Promise<void>) => {
        const shouldClose = ('closeOnSelect' in node ? node.closeOnSelect : undefined) ?? closeOnSelect;

        // Confirm gate
        const needsConfirm = 'confirm' in node && node.confirm != null;
        if (needsConfirm) {
            ev.preventDefault();
            setConfirmNode(node);
            setConfirmEvent(ev);
            return;
        }

        await commit();

        // Let caller know
        onItemSelect?.({ node, event: ev });

        // Close handled by Radix automatically unless preventDefault() is called.
        // If we want to keep it open, we call preventDefault() here.
        if (!shouldClose && 'preventDefault' in ev) {
            ev.preventDefault?.();
        }
    };

    /** Confirm dialog proceed */
    const confirmProceed = async () => {
        if (!confirmNode || !confirmEvent) return;
        const node = confirmNode;
        const ev = confirmEvent;
        setConfirmNode(null);
        setConfirmEvent(null);

        const commit = async () => {
            // Branch on node type
            if (isLink(node)) {
                setLoading(node.id, true);
                try {
                    await runCommand(node, ev, { onBeforeCommand, onAfterCommand, onCommandError }, node.command);
                } finally {
                    setLoading(node.id, false);
                }
                // Nav is left to consumer LinkComponent/native anchor
            } else if (isCheckbox(node)) {
                const next = !node.checked;
                setLoading(node.id, true);
                try {
                    await node.onCheckedChange?.(next);
                } finally {
                    setLoading(node.id, false);
                }
            } else if (isRadioGroup(node)) {
                // not applicable
            } else {
                setLoading(node.id, true);
                try {
                    await runCommand(node, ev, { onBeforeCommand, onAfterCommand, onCommandError }, (node as ActionItem).command);
                } finally {
                    setLoading(node.id, false);
                }
            }
        };

        await commit();
        onItemSelect?.({ node, event: ev });
    };

    /** Content style controls */
    const contentStyle = {
        ...(matchTriggerWidth ? { '--dropdown-min-w': 'var(--radix-dropdown-menu-trigger-width)' } : {}),
    } as React.CSSProperties;

    const contentWidthClass = matchTriggerWidth ? 'min-w-[--dropdown-min-w]' : 'min-w-44';

    return (
        <>
            <DropdownMenu onOpenChange={onOpenChange} open={open} defaultOpen={defaultOpen}>
                <DropdownMenuTrigger asChild>{children ?? trigger}</DropdownMenuTrigger>

                <DropdownMenuPortal container={container ?? undefined}>
                    <DropdownMenuContent
                        side={side}
                        align={align}
                        sideOffset={sideOffset}
                        avoidCollisions={avoidCollisions}
                        collisionPadding={collisionPadding}
                        className={cn(contentWidthClass, contentClassName, 'p-0')}
                        style={contentStyle}
                    >
                        {/* Scroll container with subtle top/bottom shadows */}
                        <div className="relative">
                            <div
                                className={cn(
                                    'max-h-[--menu-max-h] overflow-y-auto overflow-x-hidden py-1.5',
                                    // Provide a CSS var for numeric or string heights
                                )}
                                style={{ '--menu-max-h': typeof maxHeight === 'number' ? `${maxHeight}px` : String(maxHeight) } as React.CSSProperties}
                            >
                                <TooltipProvider delayDuration={250}>
                                    {prunedMenu.map((node, idx) => (
                                        <RenderNode
                                            key={node.id ?? idx}
                                            node={node}
                                            size={size}
                                            LinkComponent={LinkComponent}
                                            linkKey={linkKey}
                                            renderItem={renderItem}
                                            onItemHover={onItemHover}
                                            onItemSelect={onItemSelect}
                                            loading={loadingIds.has(node.id)}
                                            setLoading={setLoading}
                                            handleSelect={handleSelect}
                                            hooks={{ onBeforeCommand, onAfterCommand, onCommandError }}
                                            renderGroupHeader={renderGroupHeader}
                                            renderSeparator={renderSeparator}
                                        />
                                    ))}
                                </TooltipProvider>
                            </div>

                            {/* top / bottom shadow gradients */}
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-linear-to-b from-black/5 to-transparent" />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-linear-to-t from-black/5 to-transparent" />
                        </div>
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenu>

            {/* Inline confirm dialog */}
            <AlertDialog open={!!confirmNode} onOpenChange={(o) => !o && (setConfirmNode(null), setConfirmEvent(null))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {typeof confirmNode?.['confirm' as keyof MenuNode] === 'string'
                                ? ('confirm' in confirmNode ? confirmNode.confirm : undefined)
                                : (confirmNode && 'confirm' in confirmNode ? confirmNode.confirm : undefined) ?? 'Please confirm this action.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmProceed}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

/* ———————————————————————————————————————————————
 * Internal renderers
 * ——————————————————————————————————————————————— */

const MaybeTooltip: React.FC<{
    tooltip?: React.ReactNode;
    children: React.ReactNode;
    disabled?: boolean;
}> = ({ tooltip, children, disabled }) =>
    tooltip && !disabled ? (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
    ) : (
        <>{children}</>
    );

const RowInner: React.FC<{
    node: MenuNode & { description?: React.ReactNode };
    size: DropdownSize;
    renderItem?: (ctx: RenderItemCtx) => React.ReactNode;
    right: React.ReactNode;
}> = ({ node, size, renderItem, right }) => {
    const defaultContent = (
        <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-0.5">
                <IconNode icon={node.icon} />
                <span className="truncate">{node.label}</span>
                {right}
            </div>
            {node.description ?
                <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{node.description}</span> : null}
        </div>
    );
    return <>{renderItem?.({ node, defaultContent, size }) ?? defaultContent}</>;
};

const RenderNode: React.FC<{
    node: MenuNode;
    size: DropdownSize;
    LinkComponent?: LinkComponentType;
    linkKey: string;
    renderItem?: (ctx: RenderItemCtx) => React.ReactNode;
    onItemHover?: (node: MenuNode) => void;
    onItemSelect?: (args: { node: MenuNode; event: Event }) => void;
    loading: boolean;
    setLoading: (id?: string | number, state?: boolean) => void;
    handleSelect: (node: MenuNode, ev: Event, commit: () => Promise<void>) => Promise<void>;
    hooks: {
        onBeforeCommand?: (node: MenuNode) => void;
        onAfterCommand?: (node: MenuNode, result: unknown) => void;
        onCommandError?: (node: MenuNode, error: unknown) => void;
    };
    renderGroupHeader?: (label?: React.ReactNode) => React.ReactNode;
    renderSeparator?: () => React.ReactNode;
}> = ({
    node,
    size,
    LinkComponent,
    linkKey,
    renderItem,
    onItemHover,
    onItemSelect,
    loading,
    setLoading,
    handleSelect,
    hooks,
    renderGroupHeader,
    renderSeparator,
}) => {
    // Separator
    if (node.type === 'separator') {
        return renderSeparator ? <>{renderSeparator()}</> : <DropdownMenuSeparator />;
    }

    // Group
    if (isGroup(node)) {
        if (!node.items?.length) return null;
        return (
            <div className={cn(node.className)}>
                {renderGroupHeader ? renderGroupHeader(node.label) : node.label ? <DropdownMenuLabel>{node.label}</DropdownMenuLabel> : null}
                <DropdownMenuGroup>
                    {node.items.map((child, i) => (
                        <RenderNode
                            key={child.id ?? i}
                            node={child}
                            size={size}
                            LinkComponent={LinkComponent}
                            linkKey={linkKey}
                            renderItem={renderItem}
                            onItemHover={onItemHover}
                            onItemSelect={onItemSelect}
                            loading={loading && child.id === node.id}
                            setLoading={setLoading}
                            handleSelect={handleSelect}
                            hooks={hooks}
                            renderGroupHeader={renderGroupHeader}
                            renderSeparator={renderSeparator}
                        />
                    ))}
                </DropdownMenuGroup>
            </div>
        );
    }

    // Submenu
    if (isSubmenu(node)) {
        if (!node.items?.length) return null;

        const right = <RightSide badge={node.badge} suffix={node.suffix} shortcut={node.shortcut} loading={loading} />;
        const inner = <RowInner node={node} size={size} renderItem={renderItem} right={right} />;

        const subTrigger = (
            <DropdownMenuSubTrigger
                aria-label={node.ariaLabel}
                disabled={node.disabled}
                className={rowClass(size, node)}
                onPointerMove={() => onItemHover?.(node)}
            >
                {inner}
            </DropdownMenuSubTrigger>
        );

        return (
            <DropdownMenuSub>
                <MaybeTooltip tooltip={node.tooltip} disabled={node.disabled}>
                    {subTrigger}
                </MaybeTooltip>
                <DropdownMenuSubContent>
                    {node.items.map((child, i) => (
                        <RenderNode
                            key={child.id ?? i}
                            node={child}
                            size={size}
                            LinkComponent={LinkComponent}
                            linkKey={linkKey}
                            renderItem={renderItem}
                            onItemHover={onItemHover}
                            onItemSelect={onItemSelect}
                            loading={loading && child.id === node.id}
                            setLoading={setLoading}
                            handleSelect={handleSelect}
                            hooks={hooks}
                            renderGroupHeader={renderGroupHeader}
                            renderSeparator={renderSeparator}
                        />
                    ))}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        );
    }

    // Checkbox
    if (isCheckbox(node)) {
        const right = <RightSide badge={node.badge} suffix={node.suffix} shortcut={node.shortcut} loading={loading} />;
        const inner = <RowInner node={node} size={size} renderItem={renderItem} right={right} />;
        return (
            <MaybeTooltip tooltip={node.tooltip} disabled={node.disabled}>
                <DropdownMenuCheckboxItem
                    aria-label={node.ariaLabel}
                    checked={node.checked}
                    onCheckedChange={async (v) => {
                        try {
                            setLoading(node.id, true);
                            await node.onCheckedChange?.(v);
                            onItemSelect?.({ node, event: new Event('change') as unknown as Event });
                        } finally {
                            setLoading(node.id, false);
                        }
                    }}
                    disabled={node.disabled}
                    className={rowClassIndicatorAware(size, node)}
                    onPointerMove={() => onItemHover?.(node)}
                    data-testid={node.testId}
                >
                    {inner}
                </DropdownMenuCheckboxItem>
            </MaybeTooltip>
        );
    }

    // Radio group
    if (isRadioGroup(node)) {
        if (!node.items?.length) return null;
        return (
            <DropdownMenuRadioGroup
                value={node.value}
                onValueChange={async (v) => {
                    try {
                        setLoading(node.id, true);
                        await node.onValueChange?.(v);
                    } finally {
                        setLoading(node.id, false);
                    }
                }}
            >
                {node.items.map((opt, i) => {
                    const right = <RightSide badge={opt.badge} suffix={opt.suffix} shortcut={opt.shortcut} loading={loading} />;
                    const inner = <RowInner node={opt as unknown as MenuNode} size={size} renderItem={renderItem} right={right} />;
                    return (
                        <MaybeTooltip key={opt.id ?? i} tooltip={opt.tooltip} disabled={opt.disabled}>
                            <DropdownMenuRadioItem
                                aria-label={opt.ariaLabel}
                                value={opt.value}
                                disabled={opt.disabled}
                                className={rowClassIndicatorAware(size, opt)}
                                onSelect={(ev) => onItemSelect?.({ node: opt as unknown as MenuNode, event: ev as unknown as Event })}
                                onPointerMove={() => onItemHover?.(opt as unknown as MenuNode)}
                                data-testid={opt.testId}
                            >
                                {inner}
                            </DropdownMenuRadioItem>
                        </MaybeTooltip>
                    );
                })}
            </DropdownMenuRadioGroup>
        );
    }

    // Link
    if (isLink(node)) {
        const dest = (node as Record<string, unknown>)[linkKey];
        const right = <RightSide badge={node.badge} suffix={node.suffix} shortcut={node.shortcut} loading={loading} />;
        const inner = <RowInner node={node} size={size} renderItem={renderItem} right={right} />;

        const commit = async () => {
            setLoading(node.id, true);
            try {
                await runCommand(node, new Event('select') as unknown as Event, hooks, node.command);
                // Navigation is handled by LinkComponent/native anchor
            } finally {
                setLoading(node.id, false);
            }
        };

        return (
            <MaybeTooltip tooltip={node.tooltip} disabled={node.disabled}>
                <DropdownMenuItem
                    aria-current={node.ariaCurrent}
                    aria-label={node.ariaLabel}
                    disabled={node.disabled}
                    className={rowClass(size, node)}
                    onPointerMove={() => onItemHover?.(node)}
                    onSelect={(ev) => handleSelect(node, ev as unknown as Event, commit)}
                    data-testid={node.testId}
                >
                    {LinkComponent && (typeof dest === 'string' || dest instanceof URL) ? (
                        <LinkComponent {...{ [linkKey]: dest, className: 'flex min-w-0 items-center gap-0.5' }}>{inner}</LinkComponent>
                    ) : (
                        <a
                            href={typeof dest === 'string' ? dest : String(dest ?? '')}
                            target={node.target}
                            rel={node.rel}
                            className="flex min-w-0 items-center gap-0.5"
                        >
                            {inner}
                        </a>
                    )}
                </DropdownMenuItem>
            </MaybeTooltip>
        );
    }

    // Default: action item
    const item = node as ActionItem;
    const right = <RightSide badge={item.badge} suffix={item.suffix} shortcut={item.shortcut} loading={loading} />;
    const inner = <RowInner node={item} size={size} renderItem={renderItem} right={right} />;

    const commit = async (ev: Event) => {
        setLoading(item.id, true);
        try {
            await runCommand(item, ev, hooks, item.command);
        } finally {
            setLoading(item.id, false);
        }
    };

    return (
        <MaybeTooltip tooltip={item.tooltip} disabled={item.disabled}>
            <DropdownMenuItem
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                onPointerMove={() => onItemHover?.(item)}
                onSelect={(ev) => handleSelect(item, ev as unknown as Event, () => commit(ev as unknown as Event))}
                className={rowClass(size, item)}
                data-testid={item.testId}
            >
                {inner}
            </DropdownMenuItem>
        </MaybeTooltip>
    );
};

export default Dropdown;
