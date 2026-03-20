import type { UseCanvasReturn } from '@timeax/digital-service-engine/workspace';
import React, { useCallback, useMemo, useState } from 'react';
import { LuPanelBottom, LuPanelRight } from 'react-icons/lu';
import { useReactFlow } from '@xyflow/react';
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
    const relation = api.getEdgeRel();

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
            },
            flow: {
                zoomIn: () => rf.zoomIn?.(),
                zoomOut: () => rf.zoomOut?.(),
                fitView: () => rf.fitView?.(),
            },
            setRelation: (rel) => api.setEdgeRel(rel),
            toggleGrid: () => setShowGrid(!showGrid),
            toggleMiniMap: () => setShowMiniMap(!showMiniMap),
        }),
        [api, mode, relation, selectionCount, canUndo, canRedo, showGrid, showMiniMap, rf, setShowGrid, setShowMiniMap],
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

    return (
        <div className={className ?? 'pointer-events-none absolute top-4 left-4 z-20'}>
            <div className={orientation === 'horizontal' ? 'flex items-start gap-2' : 'grid gap-2'}>
                {Object.entries(groups).map(([group, arr]) => (
                    <div
                        key={group}
                        className={
                            'pointer-events-auto rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-md dark:border-slate-800 dark:bg-slate-950/95 ' +
                            (orientation === 'vertical' ? 'flex flex-col items-stretch gap-0.5' : 'inline-flex items-center gap-0.5')
                        }
                    >
                        {arr.map((button) =>
                            renderButton ? (
                                renderButton(button, button.id)
                            ) : (
                                <DefaultTool key={button.id} {...button} labelPlacement={labelPlacement} orientation={orientation} />
                            ),
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={onToggleOrientation}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-md transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    title={orientation === 'horizontal' ? 'Switch to vertical toolbar' : 'Switch to horizontal toolbar'}
                >
                    {orientation === 'horizontal' ? <LuPanelRight /> : <LuPanelBottom />}
                </button>
            </div>
        </div>
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
            id: 'view:grid',
            kind: 'toggle',
            group: 'view',
            order: 10,
            label: 'Grid',
            icon: (active) => Icons.grid(active),
            active: (ctx) => ctx.state.showGrid,
            action: (ctx) => ctx.toggleGrid(),
        },
        {
            id: 'view:minimap',
            kind: 'toggle',
            group: 'view',
            order: 20,
            label: 'Minimap',
            icon: (active) => Icons.minimap(active),
            active: (ctx) => ctx.state.showMiniMap,
            action: (ctx) => ctx.toggleMiniMap(),
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
}: ToolRender & { labelPlacement: LabelPlacement; orientation: ToolbarOrientation }) {
    const base =
        'inline-flex items-center justify-center rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-600 transition ' +
        'hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ' +
        (active ? 'ring-1 ring-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 ' : '') +
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
                    (orientation === 'vertical' ? ' h-8 w-full' : ' h-8 w-8') +
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
                    (orientation === 'vertical' ? ' h-8 w-full' : ' h-8 w-8') +
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
                                    title={labelPlacement === 'tooltip' ? (child.disabled ? child.disabledReason ?? child.label : child.label) : undefined}
                                    disabled={child.disabled}
                                    onClick={child.onClick}
                                    className={
                                        'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 ' +
                                        (child.disabled ? 'cursor-not-allowed opacity-50' : '')
                                    }
                                >
                                    {child.icon ?? null}
                                    <span>{child.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
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
