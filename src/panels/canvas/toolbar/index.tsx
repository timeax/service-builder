import type { UseCanvasReturn } from '@timeax/digital-service-engine/workspace';
import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { LuPanelBottom, LuPanelRight } from 'react-icons/lu';
import { useReactFlow } from '@xyflow/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { resolveTools } from './merge.ts';
import { Icons } from './icons.tsx';
import type { LabelPlacement, ResolvedTools, ToolContext, ToolDescriptor, ToolbarOrientation, ToolsConfig } from './types.ts';

export type ToolbarProps = {
    api: CanvasAPI;
    mode?: 'dev' | 'prod';
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    showMiniMap: boolean;
    setShowMiniMap: (v: boolean) => void;
    showBindEdges: boolean;
    setShowBindEdges: (v: boolean) => void;
    showIncludeEdges: boolean;
    setShowIncludeEdges: (v: boolean) => void;
    showExcludeEdges: boolean;
    setShowExcludeEdges: (v: boolean) => void;
    focusCurrentContext: boolean;
    setFocusCurrentContext: (v: boolean) => void;
    canUndo?: boolean;
    canRedo?: boolean;
    tools?: ToolsConfig;
    labelPlacement?: LabelPlacement;
    renderButton?: (tool: ToolRender, key: string) => React.ReactNode;
    orientation?: ToolbarOrientation;
    onToggleOrientation?: () => void;
    className?: string;
};

type CanvasAPI = UseCanvasReturn['api'];
type EdgeRelation = ReturnType<CanvasAPI['getEdgeRel']>;

export type ToolRender = {
    id: string;
    label?: string;
    icon?: React.ReactNode;
    active: boolean;
    disabled: boolean;
    disabledReason?: string;
    onClick: () => void;
    group?: string;
    hasMenu?: boolean;
    open?: boolean;
    onToggleMenu?: () => void;
    children?: ToolRender[];
};

export function Toolbar({
    api,
    mode = 'dev',
    showGrid,
    setShowGrid,
    showMiniMap,
    setShowMiniMap,
    showBindEdges,
    setShowBindEdges,
    showIncludeEdges,
    setShowIncludeEdges,
    showExcludeEdges,
    setShowExcludeEdges,
    focusCurrentContext,
    setFocusCurrentContext,
    canUndo = false,
    canRedo = false,
    tools,
    labelPlacement = 'tooltip',
    renderButton,
    orientation = 'horizontal',
    onToggleOrientation,
    className,
}: ToolbarProps) {
    const rf = useReactFlow();
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const selectionCount = api.getSelection().length;
    const relation = useCanvasEdgeRelation(api);

    const ctx: ToolContext = useMemo(
        () => ({
            api,
            env: { mode },
            state: {
                relation,
                selectionCount,
                canUndo,
                canRedo,
                showGrid,
                showMiniMap,
                showBindEdges,
                showIncludeEdges,
                showExcludeEdges,
                focusCurrentContext,
            },
            flow: {
                zoomIn: () => rf.zoomIn?.(),
                zoomOut: () => rf.zoomOut?.(),
                fitView: () => rf.fitView?.(),
            },
            setRelation: (rel) => api.setEdgeRel(rel),
            toggleGrid: () => setShowGrid(!showGrid),
            toggleMiniMap: () => setShowMiniMap(!showMiniMap),
            toggleBindEdges: () => setShowBindEdges(!showBindEdges),
            toggleIncludeEdges: () => setShowIncludeEdges(!showIncludeEdges),
            toggleExcludeEdges: () => setShowExcludeEdges(!showExcludeEdges),
            toggleFocusCurrentContext: () => setFocusCurrentContext(!focusCurrentContext),
        }),
        [
            api,
            mode,
            relation,
            selectionCount,
            canUndo,
            canRedo,
            showGrid,
            showMiniMap,
            showBindEdges,
            showIncludeEdges,
            showExcludeEdges,
            focusCurrentContext,
            rf,
            setShowGrid,
            setShowMiniMap,
            setShowBindEdges,
            setShowIncludeEdges,
            setShowExcludeEdges,
            setFocusCurrentContext,
        ],
    );

    const descriptors: ResolvedTools = useMemo(() => resolveTools({ base: defaultTools(), ...(tools ?? {}) }), [tools]);

    const buildRenderable = useCallback(
        (defs: ToolDescriptor[]): ToolRender[] =>
            defs
                .filter((tool) => (tool.when ? !!tool.when(ctx) : true))
                .map((tool) => {
                    const enabled = tool.enabled ? tool.enabled(ctx) : true;
                    const enabledOk = typeof enabled === 'boolean' ? enabled : enabled.ok !== false;
                    const reason = typeof enabled === 'boolean' ? undefined : enabled.reason;
                    const active = tool.active ? !!tool.active(ctx) : false;

                    let iconNode: React.ReactNode | undefined;
                    if (typeof tool.icon === 'function') iconNode = tool.icon(active, !enabledOk);
                    else if (typeof tool.icon === 'string') iconNode = mapIcon(tool.icon, active);

                    const onClick = async () => {
                        if (!enabledOk || !tool.action) return;
                        try {
                            tool.onBefore?.(ctx);
                            await tool.action(ctx);
                            tool.onAfter?.(ctx);
                        } catch (err) {
                            tool.onError?.(ctx, err);
                            api.emit('error', {
                                message: (err as any)?.message ?? 'Tool action failed',
                                meta: { tool: tool.id },
                            });
                        }
                    };

                    const hasMenu = !!(tool.children && tool.children.length);
                    return {
                        id: tool.id,
                        label: tool.label,
                        icon: iconNode,
                        active,
                        disabled: !enabledOk,
                        disabledReason: reason,
                        onClick,
                        group: tool.group,
                        hasMenu,
                        open: hasMenu && openMenuId === tool.id,
                        onToggleMenu: hasMenu ? () => setOpenMenuId(openMenuId === tool.id ? null : tool.id) : undefined,
                        children: hasMenu ? buildRenderable(tool.children ?? []) : undefined,
                    };
                }),
        [api, ctx, openMenuId],
    );

    const items = buildRenderable(descriptors);
    const groups = groupBy(items, (item) => item.group ?? 'view');
    const relationTools = groups.relation ?? [];
    const viewMenu = items.find((item) => item.id === 'view:menu');

    return (
        <div className={className ?? 'pointer-events-none absolute top-4 left-4 z-20'}>
            <div className={orientation === 'horizontal' ? 'flex items-center gap-2' : 'grid gap-2'}>
                {relationTools.length ? (
                    <div
                        className={
                            'pointer-events-auto rounded-2xl border border-slate-200/90 bg-white/92 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/92 ' +
                            (orientation === 'vertical' ? 'flex flex-col items-stretch gap-1' : 'inline-flex items-center gap-1')
                        }
                    >
                        {relationTools.map((button) =>
                            renderButton ? (
                                renderButton(button, button.id)
                            ) : (
                                <DefaultTool key={button.id} {...button} labelPlacement={labelPlacement} orientation={orientation} segment="relation" />
                            ),
                        )}
                    </div>
                ) : null}
                {viewMenu ? (
                    <ViewMenuTool
                        tool={viewMenu}
                        labelPlacement={labelPlacement}
                        renderButton={renderButton}
                    />
                ) : null}
                <button
                    type="button"
                    onClick={onToggleOrientation}
                    aria-label={orientation === 'horizontal' ? 'Switch to vertical toolbar' : 'Switch to horizontal toolbar'}
                    className={toolbarStandaloneButtonClass()}
                    title={orientation === 'horizontal' ? 'Switch to vertical toolbar' : 'Switch to horizontal toolbar'}
                >
                    {orientation === 'horizontal' ? <LuPanelRight /> : <LuPanelBottom />}
                </button>
            </div>
        </div>
    );
}

function useCanvasEdgeRelation(api: CanvasAPI): EdgeRelation {
    return useSyncExternalStore(
        (onStoreChange) => api.on('edge:change', onStoreChange),
        () => api.getEdgeRel(),
        () => api.getEdgeRel(),
    );
}

function defaultTools(): ToolDescriptor[] {
    return [
        {
            id: 'mode:bind',
            kind: 'mode',
            group: 'relation',
            order: 10,
            label: 'Bind',
            icon: (active) => Icons.bind(active),
            active: (ctx) => ctx.state.relation === 'bind',
            action: (ctx) => ctx.setRelation('bind'),
        },
        {
            id: 'mode:include',
            kind: 'mode',
            group: 'relation',
            order: 20,
            label: 'Include',
            icon: (active) => Icons.include(active),
            active: (ctx) => ctx.state.relation === 'include',
            action: (ctx) => ctx.setRelation('include'),
        },
        {
            id: 'mode:exclude',
            kind: 'mode',
            group: 'relation',
            order: 30,
            label: 'Exclude',
            icon: (active) => Icons.exclude(active),
            active: (ctx) => ctx.state.relation === 'exclude',
            action: (ctx) => ctx.setRelation('exclude'),
        },
        {
            id: 'view:menu',
            kind: 'menu',
            group: 'view',
            order: 10,
            label: 'Canvas view',
            icon: (active) => Icons.visibilityMenu(active),
            active: (ctx) =>
                !ctx.state.showBindEdges ||
                !ctx.state.showIncludeEdges ||
                ctx.state.showExcludeEdges ||
                ctx.state.focusCurrentContext ||
                !ctx.state.showGrid ||
                ctx.state.showMiniMap,
            children: [
                {
                    id: 'view:bind-edges',
                    kind: 'toggle',
                    label: 'Show bind edges',
                    icon: (active) => Icons.bindVisible(active),
                    active: (ctx) => ctx.state.showBindEdges,
                    action: (ctx) => ctx.toggleBindEdges(),
                },
                {
                    id: 'view:include-edges',
                    kind: 'toggle',
                    label: 'Show include edges',
                    icon: (active) => Icons.includeVisible(active),
                    active: (ctx) => ctx.state.showIncludeEdges,
                    action: (ctx) => ctx.toggleIncludeEdges(),
                },
                {
                    id: 'view:exclude-edges',
                    kind: 'toggle',
                    label: 'Show exclude edges',
                    icon: (active) => Icons.excludeVisible(active),
                    active: (ctx) => ctx.state.showExcludeEdges,
                    action: (ctx) => ctx.toggleExcludeEdges(),
                },
                {
                    id: 'view:focus-context',
                    kind: 'toggle',
                    label: 'Focus current context',
                    icon: (active) => Icons.focusContext(active),
                    active: (ctx) => ctx.state.focusCurrentContext,
                    action: (ctx) => ctx.toggleFocusCurrentContext(),
                },
                {
                    id: 'view:grid',
                    kind: 'toggle',
                    label: 'Grid',
                    icon: (active) => Icons.grid(active),
                    active: (ctx) => ctx.state.showGrid,
                    action: (ctx) => ctx.toggleGrid(),
                },
                {
                    id: 'view:minimap',
                    kind: 'toggle',
                    label: 'Minimap',
                    icon: (active) => Icons.minimap(active),
                    active: (ctx) => ctx.state.showMiniMap,
                    action: (ctx) => ctx.toggleMiniMap(),
                },
            ],
        },
        // {
        //     id: 'zoom:menu',
        //     kind: 'menu',
        //     group: 'viewport',
        //     order: 5,
        //     label: 'Viewport',
        //     icon: () => Icons.viewport(),
        //     children: [
        //         { id: 'zoom:in', kind: 'command', label: 'Zoom In', icon: () => Icons.zoomIn(), action: (ctx) => ctx.flow.zoomIn() },
        //         { id: 'zoom:out', kind: 'command', label: 'Zoom Out', icon: () => Icons.zoomOut(), action: (ctx) => ctx.flow.zoomOut() },
        //         { id: 'zoom:fit', kind: 'command', label: 'Fit', icon: () => Icons.fit(), action: (ctx) => ctx.flow.fitView() },
        //     ],
        // },
    ];
}

function DefaultTool({
    label,
    icon,
    active,
    disabled,
    disabledReason,
    onClick,
    hasMenu,
    open,
    onToggleMenu,
    children,
    labelPlacement,
    orientation,
    segment = 'default',
}: ToolRender & { labelPlacement: LabelPlacement; orientation: ToolbarOrientation; segment?: 'default' | 'relation' }) {
    const base =
        'inline-flex items-center justify-center border border-transparent bg-transparent px-2 py-1 text-xs text-slate-600 transition ' +
        'hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ' +
        (segment === 'relation' ? 'rounded-xl ' : 'rounded-md ') +
        (active
            ? segment === 'relation'
                ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)] dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 '
                : 'ring-1 ring-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 '
            : '') +
        (disabled ? 'cursor-not-allowed opacity-50 ' : '');

    const title = labelPlacement === 'tooltip' ? (disabled ? disabledReason ?? label : label) : undefined;

    const content = (
        <>
            {icon ?? null}
            {labelPlacement === 'inline' && label ? <span className="ml-1">{label}</span> : null}
            {labelPlacement === 'below' && label ? <span className="mt-0.5 block text-[10px] leading-3 text-slate-500 dark:text-slate-400">{label}</span> : null}
            {hasMenu ? <span className="ml-1">{Icons.chevronDown()}</span> : null}
        </>
    );

    if (!hasMenu) {
        return (
            <button
                type="button"
                title={title}
                aria-pressed={active}
                disabled={disabled}
                onClick={onClick}
                className={
                    base +
                    (orientation === 'vertical' ? ' h-10 w-full' : segment === 'relation' ? ' h-10 w-10' : ' h-8 w-8') +
                    (labelPlacement === 'below' ? ' flex-col' : '')
                }
            >
                {content}
            </button>
        );
    }

    return (
        <div className="relative">
            <button
                type="button"
                title={title}
                aria-expanded={open ? 'true' : 'false'}
                disabled={disabled}
                onClick={onToggleMenu}
                className={
                    base +
                    (orientation === 'vertical' ? ' h-10 w-full' : segment === 'relation' ? ' h-10 w-10' : ' h-8 w-8') +
                    (labelPlacement === 'below' ? ' flex-col' : '')
                }
            >
                {content}
            </button>
            {open ? (
                <div className="absolute left-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900" role="menu">
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {children?.map((child) => (
                            <li key={child.id}>
                                <button
                                    type="button"
                                    role="menuitem"
                                    aria-pressed={child.active}
                                    title={labelPlacement === 'tooltip' ? (child.disabled ? child.disabledReason ?? child.label : child.label) : undefined}
                                    disabled={child.disabled}
                                    onClick={child.onClick}
                                    className={
                                        'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 ' +
                                        (child.active ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 ' : '') +
                                        (child.disabled ? 'cursor-not-allowed opacity-50' : '')
                                    }
                                >
                                    {child.icon ?? null}
                                    <span>{child.label}</span>
                                    {child.active ? <span className="ml-auto text-[11px] font-medium text-blue-600 dark:text-blue-300">On</span> : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

function ViewMenuTool({
    tool,
    labelPlacement,
    renderButton,
}: {
    tool: ToolRender;
    labelPlacement: LabelPlacement;
    renderButton?: (tool: ToolRender, key: string) => React.ReactNode;
}) {
    if (renderButton) {
        return renderButton(tool, tool.id);
    }

    const indicatorCount = tool.children?.filter((child) => child.active).length ?? 0;

    return (
        <Popover open={tool.open} onOpenChange={() => tool.onToggleMenu?.()}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={labelPlacement === 'tooltip' ? tool.label : undefined}
                    aria-expanded={tool.open ? 'true' : 'false'}
                    aria-label={tool.label}
                    className={toolbarStandaloneButtonClass(tool.active)}
                >
                    {tool.icon}
                    {tool.active ? (
                        <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-950" />
                    ) : null}
                    {indicatorCount > 0 ? <span className="sr-only">{indicatorCount} active view options</span> : null}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 rounded-2xl border-slate-200/90 bg-white/98 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/98">
                <ViewSection title="Edge Layers" items={tool.children?.filter((child) => child.id.startsWith('view:') && child.id.includes('edges')) ?? []} />
                <ViewSection title="Canvas" items={tool.children?.filter((child) => !child.id.includes('edges')) ?? []} className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800" />
            </PopoverContent>
        </Popover>
    );
}

function ViewSection({ title, items, className }: { title: string; items: ToolRender[]; className?: string }) {
    return (
        <div className={className}>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{title}</div>
            <div className="grid gap-1">
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={item.active}
                        aria-pressed={item.active}
                        disabled={item.disabled}
                        onClick={item.onClick}
                        className={
                            'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-slate-50 ' +
                            (item.active ? 'bg-slate-100 dark:bg-slate-900 ' : '') +
                            (item.disabled ? 'cursor-not-allowed opacity-50' : '')
                        }
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                            {item.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{compactLabel(item.label)}</span>
                        <span
                            aria-hidden="true"
                            className={
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold transition ' +
                                (item.active
                                    ? 'border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950'
                                    : 'border-slate-200 bg-white text-transparent dark:border-slate-700 dark:bg-slate-950')
                            }
                        >
                            {item.active ? '✓' : '•'}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function compactLabel(label?: string) {
    switch (label) {
        case 'Show bind edges':
            return 'Bind edges';
        case 'Show include edges':
            return 'Include edges';
        case 'Show exclude edges':
            return 'Exclude edges';
        case 'Focus current context':
            return 'Focus context';
        default:
            return label;
    }
}

function toolbarStandaloneButtonClass(active = false) {
    return (
        'pointer-events-auto relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-white/92 text-[18px] leading-none shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition ' +
        '[&_svg]:h-5 [&_svg]:w-5 ' +
        (active
            ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.3),0_10px_24px_rgba(15,23,42,0.12)] hover:bg-blue-100 hover:text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/20 dark:hover:text-blue-200 '
            : 'border-slate-200/90 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/92 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100 ')
    );
}

function mapIcon(token: string, active: boolean): React.ReactNode {
    switch (token) {
        case 'bind':
            return Icons.bind(active);
        case 'include':
            return Icons.include(active);
        case 'exclude':
            return Icons.exclude(active);
        case 'zoom-in':
            return Icons.zoomIn();
        case 'zoom-out':
            return Icons.zoomOut();
        case 'fit':
            return Icons.fit();
        case 'grid':
            return Icons.grid(active);
        case 'minimap':
            return Icons.minimap(active);
        default:
            return <span className="text-xs text-slate-500">{token}</span>;
    }
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
    const out: Record<string, T[]> = {};
    for (const x of arr) {
        const k = key(x);
        if (!out[k]) out[k] = [];
        out[k].push(x);
    }
    return out;
}
