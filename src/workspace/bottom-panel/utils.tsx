import type { ServiceContextState } from '@/builder/service-context.ts';
import { cn } from '@/lib/utils.ts';
import { type ErrorLog, useCanvas, type ValidationRow } from '@timeax/digital-service-engine/workspace';
import { startTransition, type ReactNode } from 'react';
import { FiAlertCircle, FiInfo } from 'react-icons/fi';

export const PANEL_MARGIN = 8;
export const PANEL_LEFT_KEY = 'service-builder.bottom-panel.pos-x';
export const PANEL_BOTTOM_KEY = 'service-builder.bottom-panel.pos-y';

export type PanelPosition = { left: number | null; bottom: number | null };
export type ConsoleSubTab = 'validation' | 'logs' | 'notices';
export type ConsoleScopeFilter = 'all' | 'activeNode';
export type ConsoleSeverityFilter = 'all' | 'error' | 'warning' | 'info';
export type ConsoleIntroState = Record<ConsoleSubTab, { minimized: boolean; closed: boolean }>;

export type ServiceNotice = {
    id: string;
    type: 'public' | 'private';
    kind: 'label' | 'warning' | 'deprecation' | 'compat' | 'migration' | 'policy' | string;
    severity: 'info' | 'warning' | 'error';
    target: { scope: 'global' } | { scope: 'node'; node_kind: 'tag' | 'field' | 'option' | string; node_id: string };
    title: string;
    description?: string;
    reason?: string;
    marked_at?: string;
    icon?: string;
    color?: string;
    meta?: Record<string, unknown>;
};

export function focusNode(canvas: ReturnType<typeof useCanvas>, nodeId: string) {
    startTransition(() => {
        canvas.setActive(nodeId);
        canvas.api.select([nodeId]);
        canvas.api.setHighlighted([nodeId]);
    });
}

export function normalizeContextState(current: ServiceContextState, fallback: ServiceContextState) {
    if (!current.selectedTagId) {
        return sameContextState(current, fallback) ? current : fallback;
    }
    return current;
}

export function sameContextState(a: ServiceContextState, b: ServiceContextState) {
    return (
        a.selectedTagId === b.selectedTagId &&
        a.strictSafety === b.strictSafety &&
        a.enforcePolicies === b.enforcePolicies &&
        a.selectedButtons.length === b.selectedButtons.length &&
        a.selectedButtons.every((value, index) => value === b.selectedButtons[index])
    );
}

export function sameIds(a: readonly string[], b: readonly string[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function iconForSeverity(severity: ValidationRow['severity']) {
    if (severity === 'error') return <FiAlertCircle className="text-lg text-rose-500" />;
    if (severity === 'warning') return <FiAlertCircle className="text-lg text-amber-500" />;
    return <FiInfo className="text-lg text-sky-500" />;
}

export function severityBadgeClassName(severity: ValidationRow['severity']) {
    return cn(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
        severity === 'error' && 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
        severity === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
        severity === 'info' && 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
    );
}

export function statusBadgeClassName(tone: 'success' | 'warning' | 'danger' | 'default') {
    return cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', filterChipClassName(tone));
}

export function filterChipClassName(tone: 'success' | 'warning' | 'danger' | 'default') {
    if (tone === 'success') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
    if (tone === 'warning') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
    if (tone === 'danger') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300';
}

export function capitalize(value: string) {
    return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function getConsoleIntroCopy(tab: ConsoleSubTab) {
    if (tab === 'validation') {
        return {
            title: 'Validation Console',
            description: 'Validation rows come from the engine validator and reflect service/schema consistency checks.',
        };
    }
    if (tab === 'logs') {
        return {
            title: 'Runtime Logs',
            description: 'Logs come from workspace/editor runtime events and can be cleared or dismissed.',
        };
    }
    return {
        title: 'Schema Notices',
        description: 'Notices come from schema props and include public/private messaging with global or node scope.',
    };
}

export function normalizeNotices(input: unknown[] | undefined): ServiceNotice[] {
    if (!Array.isArray(input)) return [];
    return input
        .map((entry, index) => {
            if (!entry || typeof entry !== 'object') return null;
            const row = entry as Record<string, unknown>;
            const rawTarget = row.target as Record<string, unknown> | undefined;
            const scope = rawTarget?.scope === 'node' ? 'node' : 'global';
            const target =
                scope === 'node'
                    ? {
                          scope: 'node' as const,
                          node_kind: String(rawTarget?.node_kind ?? 'node'),
                          node_id: String(rawTarget?.node_id ?? ''),
                      }
                    : ({ scope: 'global' } as const);
            return {
                id: typeof row.id === 'string' ? row.id : `notice:${index}`,
                type: row.type === 'private' ? 'private' : 'public',
                kind: typeof row.kind === 'string' ? row.kind : 'warning',
                severity: row.severity === 'error' || row.severity === 'warning' ? row.severity : 'info',
                target,
                title: typeof row.title === 'string' && row.title.trim() ? row.title : 'Untitled notice',
                description: typeof row.description === 'string' ? row.description : undefined,
                reason: typeof row.reason === 'string' ? row.reason : undefined,
                marked_at: typeof row.marked_at === 'string' ? row.marked_at : undefined,
                icon: typeof row.icon === 'string' ? row.icon : undefined,
                color: typeof row.color === 'string' ? row.color : undefined,
                meta: row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : undefined,
            } satisfies ServiceNotice;
        })
        .filter(Boolean) as ServiceNotice[];
}

export function matchesSeverity(severity: 'error' | 'warning' | 'info', filter: ConsoleSeverityFilter) {
    return filter === 'all' || severity === filter;
}

export function matchesValidationScope(row: ValidationRow, scopeFilter: ConsoleScopeFilter, activeNodeIds: ReadonlySet<string>) {
    if (scopeFilter === 'all') return true;
    if (!activeNodeIds.size) return false;
    const ids = new Set<string>();
    if (row.nodeId) ids.add(String(row.nodeId));
    const affectedIds = Array.isArray(row.details?.affectedIds) ? row.details.affectedIds : [];
    for (const id of affectedIds) ids.add(String(id));
    for (const id of ids) {
        if (activeNodeIds.has(id)) return true;
    }
    return false;
}

export function matchesLogScope(row: ErrorLog, scopeFilter: ConsoleScopeFilter, activeNodeIds: ReadonlySet<string>) {
    if (scopeFilter === 'all') return true;
    if (!activeNodeIds.size) return false;
    const ids = extractLogNodeIds(row);
    return ids.some((id) => activeNodeIds.has(id));
}

export function matchesNoticeScope(notice: ServiceNotice, scopeFilter: ConsoleScopeFilter, activeNodeIds: ReadonlySet<string>) {
    if (scopeFilter === 'all') return true;
    if (!activeNodeIds.size) return false;
    if (notice.target.scope !== 'node') return false;
    return activeNodeIds.has(String(notice.target.node_id));
}

export function extractLogNodeIds(row: ErrorLog) {
    const ids = new Set<string>();
    const meta = row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : {};
    const directNodeId = meta.nodeId ?? meta.node_id;
    if (typeof directNodeId === 'string') ids.add(directNodeId);

    const affected = meta.affectedIds ?? meta.affected_ids;
    if (Array.isArray(affected)) {
        for (const id of affected) {
            if (typeof id === 'string' || typeof id === 'number') ids.add(String(id));
        }
    }

    return Array.from(ids);
}

export function clampPanelPosition(
    position: { left: number; bottom: number },
    panelEl: HTMLDivElement | null,
    containerEl: HTMLDivElement | null,
) {
    if (!panelEl || !containerEl) return position;

    const panelRect = panelEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const maxLeft = Math.max(PANEL_MARGIN, containerRect.width - panelRect.width - PANEL_MARGIN);
    const maxBottom = Math.max(PANEL_MARGIN, containerRect.height - panelRect.height - PANEL_MARGIN);

    return {
        left: clampNumber(position.left, PANEL_MARGIN, maxLeft),
        bottom: clampNumber(position.bottom, PANEL_MARGIN, maxBottom),
    };
}

export function resolvePanelPosition(position: PanelPosition, panelEl: HTMLDivElement | null, containerEl: HTMLDivElement | null) {
    if (!panelEl || !containerEl) {
        return {
            left: position.left ?? PANEL_MARGIN,
            bottom: position.bottom ?? PANEL_MARGIN,
        };
    }

    const panelRect = panelEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const defaultLeft = Math.max(PANEL_MARGIN, (containerRect.width - panelRect.width) / 2);

    return clampPanelPosition(
        {
            left: position.left ?? defaultLeft,
            bottom: position.bottom ?? PANEL_MARGIN,
        },
        panelEl,
        containerEl,
    );
}

export function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function readStoredPanelPosition(): PanelPosition {
    if (typeof window === 'undefined') return { left: null, bottom: null };
    const left = Number(window.localStorage.getItem(PANEL_LEFT_KEY));
    const bottom = Number(window.localStorage.getItem(PANEL_BOTTOM_KEY));
    return {
        left: Number.isFinite(left) ? left : null,
        bottom: Number.isFinite(bottom) ? bottom : null,
    };
}

export function persistPanelPosition(position: { left: number; bottom: number }) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PANEL_LEFT_KEY, String(Math.round(position.left)));
    window.localStorage.setItem(PANEL_BOTTOM_KEY, String(Math.round(position.bottom)));
}

export function ensureSelectedRow(current: string | null, rows: any[]) {
     if (current && rows.some((row) => row.id === current)) return current;
    return rows[0]?.id ?? null;
}

export function describeValidationScope(canvas: ReturnType<typeof useCanvas>, row: ValidationRow) {
    const chips: string[] = [];

    if (row.nodeId) {
        chips.push(toNodeChip(canvas, row.nodeId));
    }

    const affectedIds = Array.isArray(row.details?.affectedIds) ? row.details.affectedIds : [];
    for (const affectedId of affectedIds) {
        chips.push(toNodeChip(canvas, String(affectedId)));
    }

    return Array.from(new Set(chips));
}

export function toNodeChip(canvas: ReturnType<typeof useCanvas>, id: string) {
    const node = canvas.selector.getNode(id);
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'label' in node.raw) {
        const kind = 'kind' in node && typeof node.kind === 'string' ? node.kind : 'node';
        const label = typeof node.raw.label === 'string' ? node.raw.label : id;
        return `${capitalize(kind)}: ${label}`;
    }
    return `Node: ${id}`;
}
