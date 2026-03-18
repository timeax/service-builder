// components/ui/panel.tsx
// noinspection SuspiciousTypeOfGuard

import { Paper } from '@/components/ui/paper';
import { cn } from '@/lib/utils';
import * as React from 'react';

export type PanelEdge = 'left' | 'right' | 'top' | 'bottom';
export type EdgeAlias = 'l' | 'r' | 't' | 'b';
export type AllAlias = 'a';

type MixedEdge = PanelEdge | EdgeAlias;
type EdgesProp = 'all' | AllAlias | ReadonlyArray<MixedEdge>;

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    edges?: EdgesProp;
    resizable?: boolean;

    defaultWidth?: number;
    defaultHeight?: number;

    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;

    edgeHitWidth?: number;
    resizeStroke?: number | string;

    /** Use top/left/right/bottom offsets (not margins) to keep the opposite edge visually fixed. */
    maintainPosition?: boolean;

    onResizeStart?: (info: { edge: PanelEdge; width: number; height: number; event: PointerEvent }) => void;
    onResize?: (info: { edge: PanelEdge; width: number; height: number; event: PointerEvent }) => void;
    onResizeEnd?: (info: { edge: PanelEdge; width: number; height: number; event: PointerEvent }) => void;
}

const EDGE_ALIAS_MAP: Record<EdgeAlias, PanelEdge> = { l: 'left', r: 'right', t: 'top', b: 'bottom' };

function normalizeEdges(edges: EdgesProp | undefined): PanelEdge[] {
    if (!edges || edges === 'all' || edges === 'a') return ['left', 'right', 'top', 'bottom'];
    const out: PanelEdge[] = [];
    for (const e of edges) {
        if ((['left', 'right', 'top', 'bottom'] as const).includes(e as PanelEdge)) out.push(e as PanelEdge);
        else if ((['l', 'r', 't', 'b'] as const).includes(e as EdgeAlias)) out.push(EDGE_ALIAS_MAP[e as EdgeAlias]);
    }
    return Array.from(new Set(out));
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
    {
        edges = 'a',
        resizable = true,
        defaultWidth,
        defaultHeight,
        minWidth = 80,
        minHeight = 80,
        maxWidth = Number.POSITIVE_INFINITY,
        maxHeight = Number.POSITIVE_INFINITY,
        edgeHitWidth = 3,
        resizeStroke = '3px',
        maintainPosition = false,
        className,
        style,
        onResizeStart,
        onResize,
        onResizeEnd,
        ...rest
    },
    forwardedRef,
) {
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    React.useImperativeHandle(forwardedRef, () => panelRef.current as HTMLDivElement);

    const allowed = React.useMemo<PanelEdge[]>(() => normalizeEdges(edges), [edges]);

    // Only set the dimension the user changes; leave the other untouched (even if undefined).
    const [size, setSize] = React.useState<{ width?: number; height?: number }>({
        width: defaultWidth,
        height: defaultHeight,
    });

    // Offsets for maintainPosition (use top/left/right/bottom, not margins)
    const [offsets, setOffsets] = React.useState<{
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
    }>({});

    const [hoverEdge, setHoverEdge] = React.useState<PanelEdge | null>(null);
    const [dragEdge, setDragEdge] = React.useState<PanelEdge | null>(null);
    const activeEdge: PanelEdge | null = dragEdge ?? hoverEdge;

    const startRef = React.useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const startOffsetsRef = React.useRef<{
        left: number;
        top: number;
        right: number;
        bottom: number;
        anchoredLeft: boolean;
        anchoredTop: boolean;
        anchoredRight: boolean;
        anchoredBottom: boolean;
    } | null>(null);

    React.useEffect(() => {
        if (!resizable) {
            setHoverEdge(null);
            setDragEdge(null);
            startRef.current = null;
            startOffsetsRef.current = null;
        }
    }, [resizable]);

    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

    const computeHoverEdge = React.useCallback(
        (evt: React.PointerEvent) => {
            if (!resizable) return null;
            const el = panelRef.current;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            const { clientX: x, clientY: y } = evt;

            const cand: Array<{ edge: PanelEdge; d: number }> = [];
            if (allowed.includes('left')) cand.push({ edge: 'left', d: Math.abs(x - rect.left) });
            if (allowed.includes('right')) cand.push({ edge: 'right', d: Math.abs(x - rect.right) });
            if (allowed.includes('top')) cand.push({ edge: 'top', d: Math.abs(y - rect.top) });
            if (allowed.includes('bottom')) cand.push({ edge: 'bottom', d: Math.abs(y - rect.bottom) });

            const within = cand.filter((c) => c.d <= edgeHitWidth);
            if (!within.length) return null;
            within.sort((a, b) => a.d - b.d);
            return within[0].edge;
        },
        [allowed, edgeHitWidth, resizable],
    );

    const onPointerMove = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!resizable || dragEdge) return;
            setHoverEdge(computeHoverEdge(e));
        },
        [computeHoverEdge, dragEdge, resizable],
    );

    const onPointerLeave = React.useCallback(() => {
        if (!dragEdge) setHoverEdge(null);
    }, [dragEdge]);

    const parseOffset = (v: string) => {
        if (!v || v === 'auto') return 0;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
    };

    const onPointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!resizable) return;
            const edge = computeHoverEdge(e);
            if (!edge) return;

            const el = panelRef.current;
            if (!el) return;

            try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {}

            const rect = el.getBoundingClientRect();
            setDragEdge(edge);
            startRef.current = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };

            if (maintainPosition) {
                const cs = getComputedStyle(el);
                const anchoredLeft = cs.left !== 'auto';
                const anchoredTop = cs.top !== 'auto';
                const anchoredRight = cs.right !== 'auto';
                const anchoredBottom = cs.bottom !== 'auto';
                startOffsetsRef.current = {
                    left: parseOffset(cs.left),
                    top: parseOffset(cs.top),
                    right: parseOffset(cs.right),
                    bottom: parseOffset(cs.bottom),
                    anchoredLeft,
                    anchoredTop,
                    anchoredRight,
                    anchoredBottom,
                };
            } else {
                startOffsetsRef.current = null;
            }

            onResizeStart?.({ edge, width: rect.width, height: rect.height, event: e.nativeEvent });
        },
        [computeHoverEdge, maintainPosition, onResizeStart, resizable],
    );

    const onPointerUp = React.useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!dragEdge) return;
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
            const rect = panelRef.current?.getBoundingClientRect();
            const finalWidth = size.width ?? rect?.width ?? 0;
            const finalHeight = size.height ?? rect?.height ?? 0;
            const finalEdge = dragEdge;

            setDragEdge(null);
            startRef.current = null;
            startOffsetsRef.current = null;
            setHoverEdge(null);

            onResizeEnd?.({ edge: finalEdge, width: finalWidth, height: finalHeight, event: e.nativeEvent });
        },
        [dragEdge, onResizeEnd, size.height, size.width],
    );

    const onPointerMoveDoc = React.useCallback(
        (e: PointerEvent) => {
            if (!dragEdge || !startRef.current) return;

            const dx = e.clientX - startRef.current.x;
            const dy = e.clientY - startRef.current.y;

            if (dragEdge === 'right' || dragEdge === 'left') {
                // X-axis only
                const nextW = clamp(dragEdge === 'right' ? startRef.current.width + dx : startRef.current.width - dx, minWidth, maxWidth);
                setSize((prev) => ({ width: nextW, height: prev.height })); // do NOT touch height

                if (maintainPosition && startOffsetsRef.current) {
                    if (dragEdge === 'left') {
                        if (startOffsetsRef.current.anchoredLeft) {
                            setOffsets((prev) => ({ ...prev, left: startOffsetsRef.current!.left + dx }));
                        }
                    } else {
                        // right edge drag — use 'right' to compensate
                        if (startOffsetsRef.current.anchoredRight) {
                            setOffsets((prev) => ({ ...prev, right: startOffsetsRef.current!.right - dx }));
                        }
                    }
                }

                const otherH = panelRef.current?.getBoundingClientRect().height ?? startRef.current.height ?? 0;
                onResize?.({ edge: dragEdge, width: nextW, height: otherH, event: e });
            } else {
                // Y-axis only
                const nextH = clamp(dragEdge === 'bottom' ? startRef.current.height + dy : startRef.current.height - dy, minHeight, maxHeight);
                setSize((prev) => ({ width: prev.width, height: nextH })); // do NOT touch width

                if (maintainPosition && startOffsetsRef.current) {
                    if (dragEdge === 'top') {
                        if (startOffsetsRef.current.anchoredTop) {
                            setOffsets((prev) => ({ ...prev, top: startOffsetsRef.current!.top + dy }));
                        }
                    } else {
                        // bottom edge drag — use 'bottom' to compensate
                        if (startOffsetsRef.current.anchoredBottom) {
                            setOffsets((prev) => ({ ...prev, bottom: startOffsetsRef.current!.bottom - dy }));
                        }
                    }
                }

                const otherW = panelRef.current?.getBoundingClientRect().width ?? startRef.current.width ?? 0;
                onResize?.({ edge: dragEdge, width: otherW, height: nextH, event: e });
            }
        },
        [dragEdge, maintainPosition, maxHeight, maxWidth, minHeight, minWidth, onResize],
    );

    React.useEffect(() => {
        if (!dragEdge) return;
        const move = (e: PointerEvent) => onPointerMoveDoc(e);
        const up = () => {
            setDragEdge(null);
            startRef.current = null;
            startOffsetsRef.current = null;
            setHoverEdge(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up, { once: true });
        window.addEventListener('pointercancel', up, { once: true });
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
        };
    }, [dragEdge, onPointerMoveDoc]);

    const cursor: React.CSSProperties['cursor'] =
        activeEdge === 'left' || activeEdge === 'right' ? 'ew-resize' : activeEdge === 'top' || activeEdge === 'bottom' ? 'ns-resize' : undefined;

    const stroke = typeof resizeStroke === 'number' ? `${resizeStroke}px` : String(resizeStroke);
    const edgeStrokeStyle: React.CSSProperties = resizable
        ? {
              ...(activeEdge === 'left' ? { borderLeftWidth: stroke, borderLeftStyle: 'solid', borderLeftColor: 'var(--border-paper)' } : null),
              ...(activeEdge === 'right' ? { borderRightWidth: stroke, borderRightStyle: 'solid', borderRightColor: 'var(--border-paper)' } : null),
              ...(activeEdge === 'top' ? { borderTopWidth: stroke, borderTopStyle: 'solid', borderTopColor: 'var(--border-paper)' } : null),
              ...(activeEdge === 'bottom'
                  ? { borderBottomWidth: stroke, borderBottomStyle: 'solid', borderBottomColor: 'var(--border-paper)' }
                  : null),
          }
        : {};

    const sizeStyle: React.CSSProperties = {
        width: size.width != null ? `${size.width}px` : undefined,
        height: size.height != null ? `${size.height}px` : undefined,
    };

    const offsetStyle: React.CSSProperties = maintainPosition
        ? {
              ...(offsets.left != null ? { left: `${offsets.left}px` } : null),
              ...(offsets.top != null ? { top: `${offsets.top}px` } : null),
              ...(offsets.right != null ? { right: `${offsets.right}px` } : null),
              ...(offsets.bottom != null ? { bottom: `${offsets.bottom}px` } : null),
          }
        : {};

    return (
        <Paper
            ref={panelRef}
            data-ui="panel"
            data-resizable={resizable ? 'true' : 'false'}
            className={cn('relative rounded-paper overflow-hidden', { 'select-none *:select-none': hoverEdge }, className)}
            style={{
                ...style,
                ...sizeStyle,
                ...offsetStyle,
                ...edgeStrokeStyle,
                touchAction: resizable ? 'none' : undefined,
                cursor: resizable ? cursor : undefined,
            }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            {...rest}
        />
    );
});

Panel.displayName = 'Panel';
