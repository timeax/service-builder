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
    canEditGraph?: boolean;
    canWriteComments?: boolean;
    onPermissionDenied?: (reason: string, meta?: Record<string, unknown>) => void;
};

type CanvasAPI = UseCanvasReturn['api'];

type RFModel = { nodes: Node[]; edges: Edge[] };
type RFSnapshotSig = {
    graph: string;
    selection: string;
};

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

function stableDataString(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `[${value.map(stableDataString).join(',')}]`;

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${key}:${stableDataString(obj[key])}`).join(',')}}`;
}

function shallowEqualObject(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        if (!(key in b) || a[key] !== b[key]) return false;
    }
    return true;
}

function applyNodeDecorator(node: Node, decorator?: Partial<Node>): Node {
    if (!decorator) return node;

    const dataPatch = 'data' in decorator && decorator.data && typeof decorator.data === 'object' ? (decorator.data as Record<string, unknown>) : undefined;
    const nextData = dataPatch ? ({ ...(node.data as object), ...dataPatch } as Node['data']) : node.data;
    const nextStyle = 'style' in decorator ? decorator.style : node.style;
    const nextHidden = 'hidden' in decorator ? decorator.hidden : node.hidden;
    const nextSelected = 'selected' in decorator ? decorator.selected : node.selected;

    const dataChanged = dataPatch ? !shallowEqualObject(node.data as Record<string, unknown>, nextData as Record<string, unknown>) : false;
    const changed = dataChanged || nextStyle !== node.style || nextHidden !== node.hidden || nextSelected !== node.selected;
    if (!changed) return node;

    return {
        ...node,
        data: nextData,
        style: nextStyle,
        hidden: nextHidden,
        selected: nextSelected,
    };
}

function applyEdgeDecorator(edge: Edge, decorator?: Partial<Edge>): Edge {
    if (!decorator) return edge;

    const dataPatch = 'data' in decorator && decorator.data && typeof decorator.data === 'object' ? (decorator.data as Record<string, unknown>) : undefined;
    const nextData = dataPatch ? ({ ...(edge.data as object), ...dataPatch } as Edge['data']) : edge.data;
    const nextStyle = 'style' in decorator ? decorator.style : edge.style;
    const nextHidden = 'hidden' in decorator ? decorator.hidden : edge.hidden;

    const dataChanged = dataPatch ? !shallowEqualObject(edge.data as Record<string, unknown>, nextData as Record<string, unknown>) : false;
    const changed = dataChanged || nextStyle !== edge.style || nextHidden !== edge.hidden;
    if (!changed) return edge;

    return {
        ...edge,
        data: nextData,
        style: nextStyle,
        hidden: nextHidden,
    };
}

function mergeNodeRuntime(prev: Node, next: Node): Node {
    if (prev.type !== next.type) return next;
    return {
        ...prev,
        ...next,
        data: next.data,
        style: next.style,
        hidden: next.hidden,
        selected: next.selected,
        position: next.position,
    };
}

function mergeEdgeRuntime(prev: Edge, next: Edge): Edge {
    return {
        ...prev,
        ...next,
        data: next.data,
        style: next.style,
        hidden: next.hidden,
    };
}

function mergeWithRuntime(prev: RFModel, next: RFModel): RFModel {
    const prevNodesById = new Map(prev.nodes.map((node) => [node.id, node]));
    const prevEdgesById = new Map(prev.edges.map((edge) => [edge.id, edge]));

    return {
        nodes: next.nodes.map((node) => {
            const prevNode = prevNodesById.get(node.id);
            return prevNode ? mergeNodeRuntime(prevNode, node) : node;
        }),
        edges: next.edges.map((edge) => {
            const prevEdge = prevEdgesById.get(edge.id);
            return prevEdge ? mergeEdgeRuntime(prevEdge, edge) : edge;
        }),
    };
}

function modelEquivalent(a: RFModel, b: RFModel): boolean {
    if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;

    for (let i = 0; i < a.nodes.length; i += 1) {
        const left = a.nodes[i];
        const right = b.nodes[i];
        if (left.id !== right.id || left.type !== right.type) return false;
        if (left.position.x !== right.position.x || left.position.y !== right.position.y) return false;
        if (left.selected !== right.selected) return false;
        if (left.hidden !== right.hidden) return false;
        if (!shallowEqualObject(left.style as Record<string, unknown>, right.style as Record<string, unknown>)) return false;
        if (!shallowEqualObject(left.data as Record<string, unknown>, right.data as Record<string, unknown>)) return false;
    }

    for (let i = 0; i < a.edges.length; i += 1) {
        const left = a.edges[i];
        const right = b.edges[i];
        if (left.id !== right.id || left.source !== right.source || left.target !== right.target) return false;
        if (left.hidden !== right.hidden) return false;
        if (!shallowEqualObject(left.style as Record<string, unknown>, right.style as Record<string, unknown>)) return false;
        if (!shallowEqualObject(left.data as Record<string, unknown>, right.data as Record<string, unknown>)) return false;
    }

    return true;
}

function buildSnapshotSig(state: ReturnType<CanvasAPI['snapshot']>, api: CanvasAPI): RFSnapshotSig {
    const graphNodeSig = state.graph.nodes.map((node) => `${node.id}:${node.kind}:${stableDataString((node as any).label)}`).join('|');
    const graphEdgeSig = state.graph.edges.map((edge) => `${edge.kind}:${edge.from}->${edge.to}`).join('|');
    const positionSig = Object.keys(state.positions)
        .sort()
        .map((id) => {
            const p = state.positions[id];
            return `${id}:${p?.x ?? 0},${p?.y ?? 0}`;
        })
        .join('|');
    const commentSig = api.comments
        .list()
        .filter((thread) => !!thread.anchor)
        .map((thread) => {
            const anchor = thread.anchor as any;
            if (!anchor) return `${thread.id}:none`;
            if (anchor.type === 'free') return `${thread.id}:free:${anchor.position?.x ?? 0},${anchor.position?.y ?? 0}`;
            if (anchor.type === 'node') return `${thread.id}:node:${anchor.nodeId}:${anchor.offset?.dx ?? 0},${anchor.offset?.dy ?? 0}`;
            return `${thread.id}:${anchor.type ?? 'unknown'}`;
        })
        .sort()
        .join('|');
    const selectionSig = Array.from(state.selection ?? []).map(String).sort().join('|');

    return {
        graph: `${graphNodeSig}__${graphEdgeSig}__${positionSig}__${commentSig}`,
        selection: selectionSig,
    };
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
    const onPermissionDeniedRef = useRef(options.onPermissionDenied);
    const lastViewportRef = useRef<RFViewport | null>(null);
    const interactionInProgressRef = useRef(false);
    const pendingSyncRef = useRef(false);
    const pendingDecoratorSyncRef = useRef(false);
    const pendingNodeHistoryRef = useRef<Record<string, { x: number; y: number }>>({});
    const dragStartPositionsRef = useRef<Record<string, { x: number; y: number } | undefined>>({});
    const suppressSelectionSyncRef = useRef(false);
    const suppressSelectionTokenRef = useRef(0);
    const suppressSelectionRafRef = useRef<number | null>(null);
    const suppressSelectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAppliedSigRef = useRef<RFSnapshotSig | null>(null);

    const [rf, setRF] = useState<RFModel>(() =>
        toRF(api.snapshot(), api, {
            nodeDecorators: nodeDecoratorsRef.current,
            edgeDecorators: edgeDecoratorsRef.current,
        }),
    );

    const beginAdapterSelectionSync = useCallback(() => {
        const token = ++suppressSelectionTokenRef.current;
        suppressSelectionSyncRef.current = true;

        if (suppressSelectionRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(suppressSelectionRafRef.current);
            suppressSelectionRafRef.current = null;
        }

        if (suppressSelectionTimerRef.current !== null) {
            clearTimeout(suppressSelectionTimerRef.current);
            suppressSelectionTimerRef.current = null;
        }

        const release = () => {
            if (suppressSelectionTokenRef.current !== token) return;
            if (suppressSelectionRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(suppressSelectionRafRef.current);
                suppressSelectionRafRef.current = null;
            }
            if (suppressSelectionTimerRef.current !== null) {
                clearTimeout(suppressSelectionTimerRef.current);
                suppressSelectionTimerRef.current = null;
            }
            suppressSelectionSyncRef.current = false;
        };

        if (typeof requestAnimationFrame === 'function') {
            suppressSelectionRafRef.current = requestAnimationFrame(() => {
                suppressSelectionRafRef.current = null;
                release();
            });
        }

        suppressSelectionTimerRef.current = setTimeout(() => {
            suppressSelectionTimerRef.current = null;
            release();
        }, 34);
    }, []);

    const syncFromSnapshot = useCallback(() => {
        const snap = api.snapshot();
        const sig = buildSnapshotSig(snap, api);
        const previousSig = lastAppliedSigRef.current;
        const graphChanged = !previousSig || previousSig.graph !== sig.graph;
        const selectionChanged = !previousSig || previousSig.selection !== sig.selection;
        if (!graphChanged && !selectionChanged) return;

        const next = toRF(snap, api, {
            nodeDecorators: nodeDecoratorsRef.current,
            edgeDecorators: edgeDecoratorsRef.current,
        });

        beginAdapterSelectionSync();
        setRF((prev) => {
            const merged = mergeWithRuntime(prev, next);
            if (modelEquivalent(prev, merged)) return prev;
            return merged;
        });

        lastAppliedSigRef.current = sig;
    }, [api, beginAdapterSelectionSync]);

    const applyDecoratorSync = useCallback(() => {
        beginAdapterSelectionSync();
        setRF((prev) => {
            let nodeChanged = false;
            let edgeChanged = false;

            const nextNodes = prev.nodes.map((node) => {
                if (!nodeDecoratorsRef.current || isCommentId(String(node.id))) return node;
                const decorator = nodeDecoratorsRef.current(String(node.id)) ?? undefined;
                const decorated = applyNodeDecorator(node, decorator);
                if (decorated !== node) nodeChanged = true;
                return decorated;
            });

            const nextEdges = prev.edges.map((edge) => {
                if (!edgeDecoratorsRef.current) return edge;
                const decorator = edgeDecoratorsRef.current(String(edge.id)) ?? undefined;
                const decorated = applyEdgeDecorator(edge, decorator);
                if (decorated !== edge) edgeChanged = true;
                return decorated;
            });

            if (!nodeChanged && !edgeChanged) return prev;
            return { nodes: nextNodes, edges: nextEdges };
        });
    }, [beginAdapterSelectionSync]);

    const requestStructuralSync = useCallback(() => {
        if (interactionInProgressRef.current) {
            pendingSyncRef.current = true;
            return;
        }
        pendingSyncRef.current = false;
        syncFromSnapshot();
    }, [syncFromSnapshot]);

    const requestDecoratorSync = useCallback(() => {
        if (interactionInProgressRef.current) {
            pendingDecoratorSyncRef.current = true;
            return;
        }
        pendingDecoratorSyncRef.current = false;
        applyDecoratorSync();
    }, [applyDecoratorSync]);

    const flushDeferredSync = useCallback(() => {
        if (interactionInProgressRef.current) return;
        if (pendingSyncRef.current) {
            pendingSyncRef.current = false;
            syncFromSnapshot();
        }
        if (pendingDecoratorSyncRef.current) {
            pendingDecoratorSyncRef.current = false;
            applyDecoratorSync();
        }
    }, [applyDecoratorSync, syncFromSnapshot]);

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
        onPermissionDeniedRef.current = options.onPermissionDenied;
    }, [options.onPermissionDenied]);

    useEffect(() => {
        nodeDecoratorsRef.current = nodeDecorators;
        requestDecoratorSync();
    }, [nodeDecorators, requestDecoratorSync]);

    useEffect(() => {
        edgeDecoratorsRef.current = edgeDecorators;
        requestDecoratorSync();
    }, [edgeDecorators, requestDecoratorSync]);

    useEffect(() => {
        requestStructuralSync();
    }, [api, requestStructuralSync]);

    const snapVector = useMemo<[number, number] | undefined>(() => {
        if (!options.snapToGrid) return undefined;
        if (options.snapToGrid === true) return [8, 8];
        return [options.snapToGrid.x || 8, options.snapToGrid.y || 8];
    }, [options.snapToGrid]);

    useEffect(() => {
        const offGraph = api.on('graph:update', requestStructuralSync);
        const offSelection = api.on('selection:change', requestStructuralSync);
        const offState = api.on('state:change', requestStructuralSync);
        const offCommentCreate = api.on('comment:thread:create', requestStructuralSync);
        const offCommentUpdate = api.on('comment:thread:update', requestStructuralSync);
        const offCommentDelete = api.on('comment:thread:delete', requestStructuralSync);
        const offCommentMove = api.on('comment:move', requestStructuralSync);
        const offCommentResolve = api.on('comment:resolve', requestStructuralSync);

        return () => {
            interactionInProgressRef.current = false;
            pendingSyncRef.current = false;
            pendingDecoratorSyncRef.current = false;
            pendingNodeHistoryRef.current = {};
            dragStartPositionsRef.current = {};
            if (suppressSelectionRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(suppressSelectionRafRef.current);
                suppressSelectionRafRef.current = null;
            }
            if (suppressSelectionTimerRef.current !== null) {
                clearTimeout(suppressSelectionTimerRef.current);
                suppressSelectionTimerRef.current = null;
            }
            suppressSelectionTokenRef.current += 1;
            suppressSelectionSyncRef.current = false;
            offGraph();
            offSelection();
            offState();
            offCommentCreate();
            offCommentUpdate();
            offCommentDelete();
            offCommentMove();
            offCommentResolve();
        };
    }, [api, requestStructuralSync]);

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
            const hasGraphMutation = changes.some((change) => {
                if (change.type === 'position' && change.position) return !isCommentId(change.id);
                if (change.type === 'remove') return !isCommentId(change.id);
                return false;
            });
            const hasCommentMutation = changes.some((change) => change.type === 'position' && change.position && isCommentId(change.id));

            if (hasGraphMutation && options.canEditGraph === false) {
                onPermissionDeniedRef.current?.('Editing is disabled. You need workspace write access and branch write access.', {
                    action: 'graph-mutation',
                });
                requestStructuralSync();
                return;
            }

            if (hasCommentMutation && options.canWriteComments === false) {
                onPermissionDeniedRef.current?.('Comment write access is disabled for this actor.', {
                    action: 'comment-move',
                });
                requestStructuralSync();
                return;
            }

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
            if (selectionDirty && !suppressSelectionSyncRef.current) {
                const next = nextNodesSnapshot.filter((node) => !isCommentId(node.id) && node.selected).map((node) => String(node.id));
                const current = api.getSelection().map(String);
                if (!sameIdSet(next, current)) api.select(next);
            }

            if (dragEnded) {
                commitNodePositionHistory();
                endInteraction();
            }
        },
        [api, applySnap, commitNodePositionHistory, endInteraction, options.canEditGraph, options.canWriteComments, requestStructuralSync, setPositionsThrottled, startInteraction],
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            const hasEdgeDelete = changes.some((change) => change.type === 'remove');
            if (hasEdgeDelete && options.canEditGraph === false) {
                onPermissionDeniedRef.current?.('Editing is disabled. You need workspace write access and branch write access.', {
                    action: 'edge-disconnect',
                });
                requestStructuralSync();
                return;
            }

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
        [api, options.canEditGraph, requestStructuralSync],
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
            if (options.canEditGraph === false) {
                onPermissionDeniedRef.current?.('Editing is disabled. You need workspace write access and branch write access.', {
                    action: 'edge-connect',
                });
                api.cancelWire();
                return;
            }
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
        [api, currentRel, options.canEditGraph],
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
