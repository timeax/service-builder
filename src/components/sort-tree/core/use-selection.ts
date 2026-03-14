import * as React from 'react';
import type { NodeKey, NodePath, TreeNode } from '../types';

type Via = 'click' | 'keyboard' | 'api';

export type SelectionCause = 'single' | 'range' | 'toggle' | 'set';

export interface SelectionMeta {
    /** What *kind* of selection action produced the next ids */
    cause: SelectionCause;

    /** Modifier keys that were held (when applicable) */
    modifiers?: {
        shift?: boolean;
        ctrl?: boolean;
        meta?: boolean;
        alt?: boolean;
    };

    /** Optional indices to help caller reason about ranges/cursor */
    anchorIndex?: number | null;
    cursorIndex?: number | null;
    fromIndex?: number;
    toIndex?: number;

    /** Useful shorthand: was this a “multi” gesture (ctrl/meta toggle or shift range) */
    isMultiGesture?: boolean;
}

export interface UseSelectionArgs<T> {
    rows: Array<{ node: TreeNode<T>; path: NodePath }>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;
    selectionMode: 'none' | 'single' | 'multiple';
    controlledValue?: string | string[] | undefined;
    defaultValue?: string | string[] | undefined;

    emit: (ids: string[], via: Via, meta: SelectionMeta) => void;

    onToggleAtRow?: (rowIndex: number, wantExpand?: boolean) => void;
}

export function useSelection<T>({ rows, getNodeKey, selectionMode, controlledValue, defaultValue, emit, onToggleAtRow }: UseSelectionArgs<T>) {
    const controlled = controlledValue !== undefined;

    const initial = React.useMemo(() => {
        const v = defaultValue;
        return new Set<string>(v === undefined ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
    }, [defaultValue]);

    const [selected, setSelected] = React.useState<Set<string>>(initial);

    React.useEffect(() => {
        if (!controlled) return;
        const v = controlledValue as any;
        setSelected(new Set<string>(v === undefined ? [] : Array.isArray(v) ? v.map(String) : [String(v)]));
    }, [controlled, controlledValue]);

    const [anchorIndex, setAnchorIndex] = React.useState<number | null>(null);
    const [cursorIndex, setCursorIndex] = React.useState<number | null>(null);

    const indexById = React.useMemo(() => {
        const m = new Map<string, number>();
        rows.forEach((r, i) => m.set(String(getNodeKey(r.node)), i));
        return m;
    }, [rows, getNodeKey]);

    function emitSelection(next: Set<string>, via: Via, meta: SelectionMeta) {
        if (!controlled) setSelected(next);
        emit(Array.from(next), via, meta);
    }

    function setSingleSelection(id: string, via: Via, meta: Omit<SelectionMeta, 'cause'> & { cause?: SelectionCause } = {}) {
        emitSelection(new Set([id]), via, {
            cause: meta.cause ?? 'single',
            ...meta,
        });
    }

    function toggleSelection(id: string, via: Via, meta: Omit<SelectionMeta, 'cause'> = {}) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);

        emitSelection(next, via, {
            cause: 'toggle',
            ...meta,
            isMultiGesture: true,
        });
    }

    function selectRange(a: number, b: number, via: Via, meta: Omit<SelectionMeta, 'cause'> = {}) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) next.add(String(getNodeKey(rows[i].node)));

        emitSelection(next, via, {
            cause: 'range',
            ...meta,
            fromIndex: lo,
            toIndex: hi,
            isMultiGesture: true,
        });
    }

    function onRowPointerDown(e: React.MouseEvent, rIndex: number, node: TreeNode<T>) {
        if (selectionMode === 'none') return;

        const id = String(getNodeKey(node));
        setCursorIndex(rIndex);

        const modifiers = {
            shift: e.shiftKey || undefined,
            ctrl: e.ctrlKey || undefined,
            meta: e.metaKey || undefined,
            alt: e.altKey || undefined,
        };

        if (selectionMode === 'single') {
            setAnchorIndex(rIndex);
            setSingleSelection(id, 'click', {
                modifiers,
                anchorIndex: rIndex,
                cursorIndex: rIndex,
            });
            return;
        }

        const isRange = e.shiftKey;
        const isMultiToggle = e.metaKey || e.ctrlKey;

        if (isRange && anchorIndex != null) {
            selectRange(anchorIndex, rIndex, 'click', {
                modifiers,
                anchorIndex,
                cursorIndex: rIndex,
            });
            return;
        }

        if (isMultiToggle) {
            if (anchorIndex == null) setAnchorIndex(rIndex);
            toggleSelection(id, 'click', {
                modifiers,
                anchorIndex: anchorIndex ?? rIndex,
                cursorIndex: rIndex,
            });
            return;
        }

        setAnchorIndex(rIndex);
        setSingleSelection(id, 'click', {
            modifiers,
            anchorIndex: rIndex,
            cursorIndex: rIndex,
        });
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (selectionMode === 'none' || !rows.length) return;

        const modifiers = {
            shift: e.shiftKey || undefined,
            ctrl: (e as any).ctrlKey || undefined,
            meta: (e as any).metaKey || undefined,
            alt: (e as any).altKey || undefined,
        };

        const maxIdx = rows.length - 1;
        const cur = cursorIndex ?? 0;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const nextIdx = e.key === 'ArrowDown' ? Math.min(maxIdx, cur + 1) : Math.max(0, cur - 1);
            setCursorIndex(nextIdx);

            if (selectionMode === 'single') {
                setAnchorIndex(nextIdx);
                setSingleSelection(String(getNodeKey(rows[nextIdx].node)), 'keyboard', {
                    modifiers,
                    anchorIndex: nextIdx,
                    cursorIndex: nextIdx,
                });
            } else {
                if (e.shiftKey && anchorIndex != null) {
                    selectRange(anchorIndex, nextIdx, 'keyboard', {
                        modifiers,
                        anchorIndex,
                        cursorIndex: nextIdx,
                    });
                } else {
                    setAnchorIndex(nextIdx);
                    setSingleSelection(String(getNodeKey(rows[nextIdx].node)), 'keyboard', {
                        modifiers,
                        anchorIndex: nextIdx,
                        cursorIndex: nextIdx,
                        // keyboard nav without shift is basically “set”
                        cause: 'set',
                    });
                }
            }
            return;
        }

        if (selectionMode === 'multiple' && (e.key === ' ' || e.key === 'Spacebar')) {
            e.preventDefault();
            const idx = cursorIndex ?? 0;
            toggleSelection(String(getNodeKey(rows[idx].node)), 'keyboard', {
                modifiers,
                anchorIndex,
                cursorIndex: idx,
            });
        }

        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const idx = cursorIndex ?? 0;
            onToggleAtRow?.(idx, e.key === 'ArrowRight');
        }
    }

    // Imperative helpers for ref API
    function apiSelect(id: string) {
        setSingleSelection(String(id), 'api', { cause: 'set', isMultiGesture: false });
    }
    function apiSelectMany(ids: string[]) {
        emitSelection(new Set(ids.map(String)), 'api', { cause: 'set', isMultiGesture: true });
    }
    function apiClear() {
        emitSelection(new Set(), 'api', { cause: 'set', isMultiGesture: false });
    }

    return {
        selected,
        indexById,
        anchorIndex,
        setAnchorIndex,
        cursorIndex,
        setCursorIndex,
        onRowPointerDown,
        onKeyDown,
        apiSelect,
        apiSelectMany,
        apiClear,
        isSelected: (id: NodeKey) => selected.has(String(id)),
    };
}
