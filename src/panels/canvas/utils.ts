import type { CanvasViewPrefs } from '@/panels/canvas/presentation.ts';
import { defaultCanvasViewPrefs } from '@/panels/canvas/presentation.ts';
import { getNodePropertyCapabilities } from '@/panels/right/partials/properties/components/node-capabilities.ts';
import type { useCanvas, useWorkspace } from '@timeax/digital-service-engine/workspace';

export type OverlayId = 'pulse' | 'focus' | 'comments';
export type OverlayState = Record<OverlayId, { closed: boolean; minimized: boolean }>;
export type HistoryState = { canUndo: boolean; canRedo: boolean };
export type CanvasViewPrefsState = CanvasViewPrefs;

export const OVERLAY_DEFAULTS: OverlayState = {
    pulse: { closed: false, minimized: false },
    focus: { closed: false, minimized: false },
    comments: { closed: false, minimized: false },
};

export function canAssignService(canvas: ReturnType<typeof useCanvas>, nodeId: string) {
    const node = canvas.selector.getNode(nodeId);
    if (!node || (node.kind !== 'tag' && node.kind !== 'field' && node.kind !== 'option')) {
        return false;
    }

    return getNodePropertyCapabilities(node).service.canEdit;
}

export function getNodeLabel(node: unknown) {
    if (node && typeof node === 'object' && 'raw' in node && node.raw && typeof node.raw === 'object' && 'label' in node.raw) {
        return String((node.raw as { label?: string }).label ?? '');
    }

    if (node && typeof node === 'object' && 'id' in node) {
        return String((node as { id?: string }).id ?? '');
    }

    return '';
}

export function storageKey(ws: ReturnType<typeof useWorkspace>) {
    return `service-builder.canvas.overlays.${ws.info.id}.${ws.branches.currentId ?? 'none'}`;
}

export function viewPrefsStorageKey(ws: ReturnType<typeof useWorkspace>) {
    return `service-builder.canvas.view-prefs.${ws.info.id}.${ws.branches.currentId ?? 'none'}`;
}

export function loadOverlayState(key: string, fallback: OverlayState): OverlayState {
    if (typeof window === 'undefined') return fallback;

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;

        const parsed = JSON.parse(raw);
        return {
            pulse: parsed?.pulse ?? fallback.pulse,
            focus: parsed?.focus ?? fallback.focus,
            comments: parsed?.comments ?? fallback.comments,
        };
    } catch {
        return fallback;
    }
}

export function persistOverlayState(key: string, state: OverlayState) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
        /* ignore storage failures */
    }
}

export function loadCanvasViewPrefs(key: string, fallback: CanvasViewPrefsState): CanvasViewPrefsState {
    if (typeof window === 'undefined') return fallback;

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;

        const parsed = JSON.parse(raw);
        return {
            showBindEdges: parsed?.showBindEdges ?? fallback.showBindEdges,
            showIncludeEdges: parsed?.showIncludeEdges ?? fallback.showIncludeEdges,
            showExcludeEdges: parsed?.showExcludeEdges ?? fallback.showExcludeEdges,
            focusCurrentContext: parsed?.focusCurrentContext ?? fallback.focusCurrentContext,
        };
    } catch {
        return fallback;
    }
}

export function persistCanvasViewPrefs(key: string, state: CanvasViewPrefsState) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
        /* ignore storage failures */
    }
}

export function restoreAllOverlays(): OverlayState {
    return {
        pulse: { closed: false, minimized: false },
        focus: { closed: false, minimized: false },
        comments: { closed: false, minimized: false },
    };
}

export function hashSnapshot(value: unknown): string {
    return JSON.stringify(toStableValue(value));
}

export function toStableValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => toStableValue(item));

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = toStableValue((value as Record<string, unknown>)[key]);
    }
    return out;
}
