import * as React from "react";
import type { NodePath, NodeKey, TreeNode } from "../types";

type Via = "click" | "keyboard" | "api";

export interface UseSelectionArgs<T> {
    rows: Array<{ node: TreeNode<T>; path: NodePath }>;
    getNodeKey: (n: TreeNode<T>) => NodeKey;
    selectionMode: "none" | "single" | "multiple";
    controlledValue?: string | string[] | undefined;
    defaultValue?: string | string[] | undefined;
    emit: (ids: string[], via: Via) => void; // caller handles onSelect + onChange(type: "selection")
    onToggleAtRow?: (rowIndex: number, wantExpand?: boolean) => void; // for ArrowLeft/Right
}

export function useSelection<T>({
                                    rows,
                                    getNodeKey,
                                    selectionMode,
                                    controlledValue,
                                    defaultValue,
                                    emit,
                                    onToggleAtRow,
                                }: UseSelectionArgs<T>) {
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

    function emitSelection(next: Set<string>, via: Via) {
        if (!controlled) setSelected(next);
        emit(Array.from(next), via);
    }

    function setSingleSelection(id: string, via: Via) {
        emitSelection(new Set([id]), via);
    }

    function toggleSelection(id: string, via: Via) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        emitSelection(next, via);
    }

    function selectRange(a: number, b: number, via: Via) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) next.add(String(getNodeKey(rows[i].node)));
        emitSelection(next, via);
    }

    function onRowPointerDown(e: React.MouseEvent, rIndex: number, node: TreeNode<T>) {
        if (selectionMode === "none") return;
        const id = String(getNodeKey(node));
        setCursorIndex(rIndex);

        if (selectionMode === "single") {
            setAnchorIndex(rIndex);
            setSingleSelection(id, "click");
            return;
        }

        const isRange = e.shiftKey;
        const isMultiToggle = e.metaKey || e.ctrlKey;

        if (isRange && anchorIndex != null) {
            selectRange(anchorIndex, rIndex, "click");
            return;
        }
        if (isMultiToggle) {
            if (anchorIndex == null) setAnchorIndex(rIndex);
            toggleSelection(id, "click");
            return;
        }
        setAnchorIndex(rIndex);
        setSingleSelection(id, "click");
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (selectionMode === "none" || !rows.length) return;

        const maxIdx = rows.length - 1;
        const cur = cursorIndex ?? 0;

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const nextIdx = e.key === "ArrowDown" ? Math.min(maxIdx, cur + 1) : Math.max(0, cur - 1);
            setCursorIndex(nextIdx);
            if (selectionMode === "single") {
                setAnchorIndex(nextIdx);
                setSingleSelection(String(getNodeKey(rows[nextIdx].node)), "keyboard");
            } else {
                if (e.shiftKey && anchorIndex != null) {
                    selectRange(anchorIndex, nextIdx, "keyboard");
                } else {
                    setAnchorIndex(nextIdx);
                    setSingleSelection(String(getNodeKey(rows[nextIdx].node)), "keyboard");
                }
            }
            return;
        }

        if (selectionMode === "multiple" && (e.key === " " || e.key === "Spacebar")) {
            e.preventDefault();
            const idx = cursorIndex ?? 0;
            toggleSelection(String(getNodeKey(rows[idx].node)), "keyboard");
        }

        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const idx = cursorIndex ?? 0;
            onToggleAtRow?.(idx, e.key === "ArrowRight"); // Right → expand, Left → collapse
        }
    }

    // Imperative helpers for ref API
    function apiSelect(id: string) {
        setSingleSelection(String(id), "api");
    }
    function apiSelectMany(ids: string[]) {
        emitSelection(new Set(ids.map(String)), "api");
    }
    function apiClear() {
        emitSelection(new Set(), "api");
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
