// SPDX-License-Identifier: GPL-3.0-only
import { useCallback, useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };

const DEFAULT_POSITION: Point = { x: 500, y: -200 };

function readPosition(key: string): Point {
    if (typeof window === 'undefined') return DEFAULT_POSITION;
    try {
        const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null');
        if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) return { x: stored.x as number, y: stored.y as number };
    } catch {
        // Storage is optional; an invalid saved position must not hide the canvas card.
    }
    return DEFAULT_POSITION;
}

function savePosition(key: string, position: Point): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(position));
    } catch {
        // The card remains draggable when storage is unavailable.
    }
}

export function useServiceContextPosition(storageKey: string) {
    const [position, setPosition] = useState(() => readPosition(storageKey));
    const positionRef = useRef(position);
    const pending = useRef<{ start: Point; latest: Point } | null>(null);

    useEffect(() => {
        pending.current = null;
        const restored = readPosition(storageKey);
        positionRef.current = restored;
        setPosition(restored);
        return () => { pending.current = null; };
    }, [storageKey]);

    const onPositionChange = useCallback((next: Point, dragging?: boolean) => {
        const previous = positionRef.current;
        positionRef.current = next;
        setPosition(next);
        if (pending.current !== null) pending.current.latest = next;
        else if (dragging) pending.current = { start: previous, latest: next };
        else if (previous.x !== next.x || previous.y !== next.y) savePosition(storageKey, next);
    }, [storageKey]);

    const onDragStop = useCallback((finalPosition?: Point) => {
        const drag = pending.current;
        if (drag === null) return;
        pending.current = null;
        const next = finalPosition ?? drag.latest;
        positionRef.current = next;
        setPosition(next);
        if (drag.start.x !== next.x || drag.start.y !== next.y) savePosition(storageKey, next);
    }, [storageKey]);

    return { position, onPositionChange, onDragStop };
}
