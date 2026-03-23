import type { UseCanvasReturn } from '@timeax/digital-service-engine/workspace';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    Connection,
    Edge,
    IsValidConnection,
    Node,
    OnConnect,
    OnConnectEnd,
    OnConnectStart,
    OnEdgesChange,
    OnMoveStart,
    OnNodesChange,
    Viewport as RFViewport,
} from '@xyflow/react';
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';

export type AdapterOptions = {
    beforeConnect?: (arg: {
        from: string;
        to: string;
        kind: 'bind' | 'include' | 'exclude';
        api: CanvasAPI;
    }) => { ok: boolean; reason?: string };
    afterConnect?: (arg: {
        from: string;
        to: string;
        kind: 'bind' | 'include' | 'exclude';
        created: boolean;
        api: CanvasAPI;
    }) => void;
    snapToGrid?: boolean | { x: number; y: number };
    throttleMs?: number;
    nodeDecorators?: (nodeId: string) => Partial<Node>;
    edgeDecorators?: (edgeId: string) => Partial<Edge>;
};

type CanvasAPI = UseCanvasReturn['api'];

type RFModel = { nodes: Node[]; edges: Edge[] };

function rafThrottle<T extends (...args: any[]) => void>(fn: T, minMs = 80): T {
    let frame = 0;
    let last = 0;
    let queuedArgs: any[] | null = null;

    const run = (now: number) => {
        frame = 0;
        last = now;
        const args = queuedArgs;
        queuedArgs = null;
        if (args) fn(...(args as Parameters<T>));
    };

    return ((...args: any[]) => {
        queuedArgs = args;
        const now = performance.now();
        if (!frame) {
            if (now - last >= minMs) run(now);
            else frame = requestAnimationFrame(run);
        }
    }) as T;
}

const isCommentId = (id: string) => id.startsWith('c::');

function sameIdSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    for (const id of b) if (!s.has(id)) return false;
    return true;
}

function commentPosition(anchor: any, state: ReturnType<CanvasAPI['snapshot']>) {
    if (!anchor) return { x: 0, y: 0 };
    if (anchor.type === 'free') return { x: anchor.position.x, y: anchor.position.y };
    if (anchor.type === 'node') {
        const base = state.positions[anchor.nodeId] ?? { x: 0, y: 0 };
        return { x: base.x + (anchor.offset?.dx ?? 32), y: base.y + (anchor.offset?.dy ?? -16) };
    }
    return { x: 0, y: 0 };
}

function toRF(state: ReturnType<CanvasAPI['snapshot']>, api: CanvasAPI, opts?: Pick<AdapterOptions, 'nodeDecorators' | 'edgeDecorators'>): RFModel {
    // console.log(state)
    const nodes: Node[] = state.graph.nodes.map((n, index) => {
        const fallback = {
            x: 120 + (index % 4) * 260,
            y: 120 + Math.floor(index / 4) * 170,
        };

        const base: Node = {
            id: n.id,
            type: n.kind,
            data: {
                node: n,
            },
            position: state.positions[n.id] ?? fallback,
            selected: state.selection.has(n.id),
        };

        if (!opts?.nodeDecorators) return base;
        const deco = opts.nodeDecorators(n.id) ?? {};
        const mergedData = 'data' in deco && deco.data && typeof deco.data === 'object' ? { ...(base.data as object), ...(deco.data as object) } : base.data;
        return { ...base, ...deco, data: mergedData } as Node;
    });

    const edges: Edge[] = state.graph.edges.map((e) => {
        const id = `${e.kind}:${e.from}->${e.to}`;
        const base: Edge = {
            id,
            source: e.from,
            target: e.to,
            type: 'default',
            data: { edge: e },
        };
        if (!opts?.edgeDecorators) return base;
        const deco = opts.edgeDecorators(id) ?? {};
        const mergedData = 'data' in deco && deco.data && typeof deco.data === 'object' ? { ...(base.data as object), ...(deco.data as object) } : base.data;
        return { ...base, ...deco, data: mergedData } as Edge;
    });

    const commentNodes: Node[] = api.comments
        .list()
        .filter((thread) => !!thread.anchor)
        .map((thread) => ({
            id: `c::${thread.id}`,
            type: 'comment',
            data: { thread },
            position: commentPosition(thread.anchor, state),
            draggable: true,
            selectable: true,
        }));

    nodes.push(...commentNodes);
    return { nodes, edges };
}

const parseEdgeId = (id: string): { kind: 'bind' | 'include' | 'exclude'; from: string; to: string } | null => {
    const sep = id.indexOf(':');
    if (sep < 0) return null;
    const k = id.slice(0, sep);
    const rest = id.slice(sep + 1);
    if (!k || !rest) return null;
    const [from, to] = rest.split('->');
    if (!from || !to) return null;
    if (k !== 'bind' && k !== 'include' && k !== 'exclude') return null;
    return { kind: k, from, to };
};

export function useReactFlowAdapter(api: CanvasAPI, options: AdapterOptions = {}) {
    const throttleMs = options.throttleMs ?? 80;
    const nodeDecorators = options.nodeDecorators;
    const edgeDecorators = options.edgeDecorators;

    const nodeDecoratorsRef = useRef(nodeDecorators);
    const edgeDecoratorsRef = useRef(edgeDecorators);
    const beforeConnectRef = useRef(options.beforeConnect);
    const afterConnectRef = useRef(options.afterConnect);
    const lastViewportRef = useRef<RFViewport | null>(null);
    const interactionInProgressRef = useRef(false);
    const pendingSyncRef = useRef(false);
    const pendingNodeHistoryRef = useRef<Record<string, { x: number; y: number }>>({});
    const dragStartPositionsRef = useRef<Record<string, { x: number; y: number } | undefined>>({});

    const syncFromSnapshot = useCallback(() => {
        const snap = api.snapshot();
        setRF(
            toRF(snap, api, {
                nodeDecorators: nodeDecoratorsRef.current,
                edgeDecorators: edgeDecoratorsRef.current,
            }),
        );
    }, [api]);

    const requestSync = useCallback(() => {
        if (interactionInProgressRef.current) {
            pendingSyncRef.current = true;
            return;
        }
        pendingSyncRef.current = false;
        syncFromSnapshot();
    }, [syncFromSnapshot]);

    const flushDeferredSync = useCallback(() => {
        if (interactionInProgressRef.current || !pendingSyncRef.current) return;
        pendingSyncRef.current = false;
        syncFromSnapshot();
    }, [syncFromSnapshot]);

    const startInteraction = useCallback(() => {
        interactionInProgressRef.current = true;
    }, []);

    const endInteraction = useCallback(() => {
        if (!interactionInProgressRef.current) return;
        interactionInProgressRef.current = false;
        flushDeferredSync();
    }, [flushDeferredSync]);

    const commitNodePositionHistory = useCallback(() => {
        const updates = pendingNodeHistoryRef.current;
        const ids = Object.keys(updates);
        if (ids.length === 0) return;

        const dragStartPositions = dragStartPositionsRef.current;
        const changedEntries = ids.filter((id) => {
            const next = updates[id];
            const start = dragStartPositions[id];
            return !start || start.x !== next.x || start.y !== next.y;
        });

        if (changedEntries.length === 0) {
            pendingNodeHistoryRef.current = {};
            dragStartPositionsRef.current = {};
            return;
        }

        const finalPositions = changedEntries.reduce<Record<string, { x: number; y: number }>>((acc, id) => {
            acc[id] = updates[id];
            return acc;
        }, {});

        pendingNodeHistoryRef.current = {};
        dragStartPositionsRef.current = {};
        api.editor.transact('canvas:move-nodes', () => {
            api.setPositions(finalPositions);
        });
    }, [api]);

    useEffect(() => {
        beforeConnectRef.current = options.beforeConnect;
    }, [options.beforeConnect]);

    useEffect(() => {
        afterConnectRef.current = options.afterConnect;
    }, [options.afterConnect]);

    useEffect(() => {
        nodeDecoratorsRef.current = nodeDecorators;
    }, [nodeDecorators]);

    useEffect(() => {
        edgeDecoratorsRef.current = edgeDecorators;
    }, [edgeDecorators]);

    useEffect(() => {
        requestSync();
    }, [api, nodeDecorators, edgeDecorators, requestSync]);

    const [rf, setRF] = useState<RFModel>(() =>
        toRF(api.snapshot(), api, {
            nodeDecorators: nodeDecoratorsRef.current,
            edgeDecorators: edgeDecoratorsRef.current,
        }),
    );

    const snapVector = useMemo<[number, number] | undefined>(() => {
        if (!options.snapToGrid) return undefined;
        if (options.snapToGrid === true) return [8, 8];
        return [options.snapToGrid.x || 8, options.snapToGrid.y || 8];
    }, [options.snapToGrid]);

    useEffect(() => {
        const offGraph = api.on('graph:update', requestSync);
        const offSelection = api.on('selection:change', requestSync);
        const offState = api.on('state:change', requestSync);
        const offCommentCreate = api.on('comment:thread:create', requestSync);
        const offCommentUpdate = api.on('comment:thread:update', requestSync);
        const offCommentDelete = api.on('comment:thread:delete', requestSync);
        const offCommentMove = api.on('comment:move', requestSync);
        const offCommentResolve = api.on('comment:resolve', requestSync);

        return () => {
            interactionInProgressRef.current = false;
            pendingSyncRef.current = false;
            pendingNodeHistoryRef.current = {};
            dragStartPositionsRef.current = {};
            offGraph();
            offSelection();
            offState();
            offCommentCreate();
            offCommentUpdate();
            offCommentDelete();
            offCommentMove();
            offCommentResolve();
        };
    }, [api, requestSync]);

    const applySnap = useCallback(
        (pos: { x: number; y: number }) => {
            if (!snapVector) return pos;
            const [gx, gy] = snapVector;
            return {
                x: Math.round(pos.x / gx) * gx,
                y: Math.round(pos.y / gy) * gy,
            };
        },
        [snapVector],
    );

    const setPositionsThrottled = useMemo(() => rafThrottle((pos: Record<string, { x: number; y: number }>) => api.setPositions(pos), throttleMs), [api, throttleMs]);
    const setViewportThrottled = useMemo(() => rafThrottle((v: RFViewport) => api.setViewport(v), throttleMs), [api, throttleMs]);

    const onNodesChange: OnNodesChange = useCallback(
        async (changes) => {
            let nextNodesSnapshot: Node[] = [];
            let dragEnded = false;
            setRF((prev) => {
                const nextNodes = applyNodeChanges(changes, prev.nodes);
                nextNodesSnapshot = nextNodes;
                return {
                    nodes: nextNodes,
                    edges: prev.edges,
                };
            });

            const posUpdates: Record<string, { x: number; y: number }> = {};
            let selectionDirty = false;

            for (const change of changes) {
                if (change.type === 'position' && typeof change.dragging === 'boolean') {
                    if (change.dragging) {
                        startInteraction();
                    } else if (interactionInProgressRef.current) {
                        dragEnded = true;
                    }
                }

                if (change.type === 'position' && change.position) {
                    if (isCommentId(change.id)) {
                        const threadId = change.id.slice(3);
                        const thread = api.comments.get(threadId);
                        if (!thread?.anchor) continue;
                        if (thread.anchor.type === 'free') {
                            await api.comments.move(threadId, {
                                type: 'free',
                                position: change.position,
                            });
                            continue;
                        }

                        if (thread.anchor.type === 'node') {
                            const nodePos = api.snapshot().positions[thread.anchor.nodeId] ?? { x: 0, y: 0 };
                            await api.comments.move(threadId, {
                                type: 'node',
                                nodeId: thread.anchor.nodeId,
                                offset: {
                                    dx: change.position.x - nodePos.x,
                                    dy: change.position.y - nodePos.y,
                                },
                            });
                            continue;
                        }
                    }

                    const snapped = applySnap(change.position);
                    if (!(change.id in dragStartPositionsRef.current)) {
                        dragStartPositionsRef.current[change.id] = api.snapshot().positions[change.id];
                    }
                    posUpdates[change.id] = snapped;
                    pendingNodeHistoryRef.current[change.id] = snapped;
                    continue;
                }

                if (change.type === 'select') {
                    if (isCommentId(change.id)) {
                        api.selectComments(change.selected ? change.id.slice(3) : undefined);
                        continue;
                    }
                    selectionDirty = true;
                }
            }

            if (Object.keys(posUpdates).length > 0) setPositionsThrottled(posUpdates);
            if (selectionDirty) {
                const next = nextNodesSnapshot.filter((node) => !isCommentId(node.id) && node.selected).map((node) => String(node.id));
                const current = api.getSelection().map(String);
                if (!sameIdSet(next, current)) api.select(next);
            }

            if (dragEnded) {
                commitNodePositionHistory();
                endInteraction();
            }
        },
        [api, applySnap, commitNodePositionHistory, endInteraction, setPositionsThrottled, startInteraction],
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            setRF((prev) => ({
                nodes: prev.nodes,
                edges: applyEdgeChanges(changes, prev.edges),
            }));

            const selectedEdgeIds: string[] = [];
            const deletions: Array<{ kind: 'bind' | 'include' | 'exclude'; from: string; to: string }> = [];

            for (const change of changes) {
                if (change.type === 'select' && change.selected) selectedEdgeIds.push(change.id);
                if (change.type === 'remove') {
                    const parsed = parseEdgeId(change.id);
                    if (parsed) deletions.push(parsed);
                }
            }

            if (selectedEdgeIds.length) {
                const endpoints = new Set<string>();
                for (const id of selectedEdgeIds) {
                    const parsed = parseEdgeId(id);
                    if (!parsed) continue;
                    endpoints.add(parsed.from);
                    endpoints.add(parsed.to);
                }
                api.setHighlighted(endpoints);
            } else {
                api.setHighlighted([]);
            }

            for (const edge of deletions) api.editor.disconnect(edge.kind, edge.from, edge.to);
        },
        [api],
    );

    const currentRel = useCallback(() => api.getEdgeRel() as 'bind' | 'include' | 'exclude', [api]);

    const isValidConnection: IsValidConnection = useCallback(
        (conn: Connection | Edge) => {
            const kind = currentRel();
            const from = conn.source ?? '';
            const to = conn.target ?? '';
            if (!from || !to || from === to) return false;
            if (isCommentId(from) || isCommentId(to)) return false;

            const guard = beforeConnectRef.current;
            if (!guard) return true;
            try {
                return !!guard({ from, to, kind, api }).ok;
            } catch {
                return false;
            }
        },
        [api, currentRel],
    );

    const onConnectStart: OnConnectStart = useCallback(
        (_evt, data) => {
            if (!data.nodeId) return;
            api.startWire(data.nodeId, currentRel());
        },
        [api, currentRel],
    );

    const onConnectEnd: OnConnectEnd = useCallback(() => api.cancelWire(), [api]);

    const onConnect: OnConnect = useCallback(
        (params) => {
            const from = params.source;
            const to = params.target;
            if (!from || !to) return;
            const kind = currentRel();

            const guard = beforeConnectRef.current;
            if (guard) {
                const res = guard({ from, to, kind, api });
                if (!res.ok) {
                    api.cancelWire();
                    return;
                }
            }

            api.startWire(from, kind);
            api.commitWire(to);
            api.editor.connect(kind, from, to);
            afterConnectRef.current?.({ from, to, kind, created: true, api });
        },
        [api, currentRel],
    );

    const onMoveEnd = useCallback(
        (_evt: unknown, viewport: RFViewport) => {
            const prev = lastViewportRef.current;
            const changed =
                !prev || Math.abs(prev.x - viewport.x) > 0.5 || Math.abs(prev.y - viewport.y) > 0.5 || Math.abs(prev.zoom - viewport.zoom) > 1e-4;
            lastViewportRef.current = viewport;
            if (changed) setViewportThrottled(viewport);
            endInteraction();
        },
        [endInteraction, setViewportThrottled],
    );

    const onMoveStart: OnMoveStart = useCallback(() => {
        startInteraction();
    }, [startInteraction]);

    const onSelectionChange = useCallback(
        (_arg: { nodes: Node[]; edges: Edge[] }) => {
            // Selection sync is owned by onNodesChange to avoid callback feedback loops.
        },
        [],
    );

    return {
        nodes: rf.nodes,
        edges: rf.edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onConnectStart,
        onConnectEnd,
        onMoveStart,
        onMoveEnd,
        onSelectionChange,
        isValidConnection,
        snapVector,
    };
}
