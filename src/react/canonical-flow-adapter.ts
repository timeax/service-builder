// SPDX-License-Identifier: GPL-3.0-only
import type { CanvasAPI, CanvasEdgeMode } from '@elqora/dgp-workspace';
import {
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type Edge,
    type IsValidConnection,
    type OnConnect,
    type OnConnectEnd,
    type OnConnectStart,
    type OnEdgesChange,
    type OnMoveEnd,
    type OnNodeDrag,
    type OnNodesChange,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCanonicalCanvasCommentTarget, toCanonicalReactFlowModel } from './canvas-model';

export interface CanonicalFlowAdapterOptions {
    can_edit?: boolean;
    snap_to_grid?: boolean | { x: number; y: number };
    scope_key?: string;
    comments_revision?: unknown;
    before_connect?: (connection: { from: string; to: string; kind: CanvasEdgeMode; api: CanvasAPI }) => {
        ok: boolean;
        reason?: string;
    };
    on_permission_denied?: (reason: string, meta?: Record<string, unknown>) => void;
}

function isCommentNode(id: string): boolean {
    return id.startsWith('comment:');
}

function relationEdge(edge: Edge): { kind: 'bind' | 'include' | 'exclude' | 'service'; from: string; to: string } | undefined {
    const value = edge.data?.edge;
    if (value === null || typeof value !== 'object') return undefined;
    const candidate = value as { kind?: string; from?: string; to?: string };
    if (
        (candidate.kind === 'bind' || candidate.kind === 'include' || candidate.kind === 'exclude' || candidate.kind === 'service') &&
        typeof candidate.from === 'string' &&
        typeof candidate.to === 'string'
    ) {
        return { kind: candidate.kind, from: candidate.from, to: candidate.to };
    }
    return undefined;
}

export function useCanonicalReactFlowAdapter(api: CanvasAPI, options: CanonicalFlowAdapterOptions = {}) {
    const commentsRevision = options.comments_revision;
    const project = useCallback(
        () => toCanonicalReactFlowModel(api.snapshot(), api.comments.list()),
        [api],
    );
    const [model, setModel] = useState(project);
    const modelRef = useRef(model);
    modelRef.current = model;
    const pendingPositions = useRef(new Map<string, { start: { x: number; y: number }; latest: { x: number; y: number } }>());

    useEffect(() => {
        void commentsRevision;
        const refresh = () => {
            const next = project();
            for (const [id, pending] of pendingPositions.current) {
                const node = next.nodes.find((candidate) => candidate.id === id);
                if (node !== undefined) node.position = pending.latest;
            }
            modelRef.current = next;
            setModel(next);
        };
        refresh();
        const offState = api.on('state:change', refresh);
        const offComments = api.on('comments:change', refresh);
        return () => {
            offState();
            offComments();
        };
    }, [api, commentsRevision, project]);

    useEffect(() => {
        const pending = pendingPositions.current;
        pending.clear();
        const next = project();
        modelRef.current = next;
        setModel(next);
        return () => pending.clear();
    }, [api, options.scope_key, project]);

    const snapVector = useMemo<[number, number] | undefined>(() => {
        if (options.snap_to_grid === true) return [16, 16];
        if (options.snap_to_grid && typeof options.snap_to_grid === 'object') {
            return [options.snap_to_grid.x, options.snap_to_grid.y];
        }
        return undefined;
    }, [options.snap_to_grid]);

    const snap = useCallback(
        (point: { x: number; y: number }) =>
            snapVector === undefined
                ? point
                : {
                      x: Math.round(point.x / snapVector[0]) * snapVector[0],
                      y: Math.round(point.y / snapVector[1]) * snapVector[1],
                  },
        [snapVector],
    );

    const commitPositions = useCallback((positions: Map<string, { x: number; y: number }>, starts?: Map<string, { x: number; y: number }>) => {
        const productMoves: Array<{ id: string; point: { x: number; y: number } }> = [];
        for (const [id, position] of positions) {
            const point = snap(position);
            const start = starts?.get(id) ?? modelRef.current.nodes.find((node) => node.id === id)?.position;
            if (start !== undefined && start.x === point.x && start.y === point.y) continue;
            if (isCommentNode(id)) {
                const threadId = id.slice('comment:'.length);
                const target = formatCanonicalCanvasCommentTarget(point);
                if (api.comments.get(threadId)?.target_path !== target) api.comments.move(threadId, target);
            } else productMoves.push({ id, point });
        }
        if (productMoves.length > 0) {
            api.editor.transact('nodes:move', () => {
                const next = { ...api.snapshot_positions() };
                for (const { id, point } of productMoves) next[id] = point;
                api.restore_positions(next);
            });
        }
    }, [api, snap]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            if (options.can_edit === false && changes.some((change) => change.type === 'position' || change.type === 'remove')) {
                options.on_permission_denied?.('Editing is disabled by workspace permissions.', { action: 'canvas-node-change' });
                setModel(project());
                return;
            }
            const before = modelRef.current.nodes;
            const nodes = applyNodeChanges(changes, before);
            const next = { ...modelRef.current, nodes };
            modelRef.current = next;
            setModel(next);
            const immediate = new Map<string, { x: number; y: number }>();
            const starts = new Map<string, { x: number; y: number }>();
            let selectionChanged = false;
            for (const change of changes) {
                if (change.type === 'position' && change.position !== undefined) {
                    const pending = pendingPositions.current.get(change.id);
                    if (pending !== undefined) pending.latest = change.position;
                    else if (change.dragging) {
                        const start = before.find((node) => node.id === change.id)?.position ?? change.position;
                        pendingPositions.current.set(change.id, { start, latest: change.position });
                    } else {
                        immediate.set(change.id, change.position);
                        const start = before.find((node) => node.id === change.id)?.position;
                        if (start !== undefined) starts.set(change.id, start);
                    }
                }
                if (change.type === 'select') selectionChanged = true;
            }
            if (immediate.size > 0) commitPositions(immediate, starts);
            if (selectionChanged) {
                const ids = nodes.filter((node) => !isCommentNode(node.id) && node.selected).map((node) => node.id);
                api.select(ids, ids.at(-1));
                const comment = nodes.find((node) => isCommentNode(node.id) && node.selected);
                api.select_comment(comment?.id.slice('comment:'.length));
            }
        },
        [api, commitPositions, options, project],
    );

    const onNodeDragStop: OnNodeDrag = useCallback((_event, _node, nodes) => {
        if (pendingPositions.current.size === 0) return;
        if (options.can_edit === false) {
            pendingPositions.current.clear();
            setModel(project());
            return;
        }
        const finalNodes = new Map(nodes.map((node) => [node.id, node.position]));
        const finalPositions = new Map<string, { x: number; y: number }>();
        const starts = new Map<string, { x: number; y: number }>();
        for (const [id, pending] of pendingPositions.current) {
            finalPositions.set(id, finalNodes.get(id) ?? pending.latest);
            starts.set(id, pending.start);
        }
        pendingPositions.current.clear();
        commitPositions(finalPositions, starts);
    }, [commitPositions, options.can_edit, project]);

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            if (options.can_edit === false && changes.some((change) => change.type === 'remove')) {
                options.on_permission_denied?.('Editing is disabled by workspace permissions.', { action: 'canvas-edge-change' });
                setModel(project());
                return;
            }
            const current = modelRef.current;
            const next = { ...current, edges: applyEdgeChanges(changes, current.edges) };
            modelRef.current = next;
            setModel(next);
            for (const change of changes) {
                if (change.type !== 'remove') continue;
                const edge = current.edges.find((candidate) => candidate.id === change.id);
                const relation = edge === undefined ? undefined : relationEdge(edge);
                if (relation !== undefined) api.editor.disconnect(relation.kind, relation.from, relation.to);
            }
        },
        [api, options, project],
    );

    const isValidConnection: IsValidConnection = useCallback(
        (connection: Connection | Edge) => {
            const from = connection.source ?? '';
            const to = connection.target ?? '';
            if (from === '' || to === '' || from === to || isCommentNode(from) || isCommentNode(to)) return false;
            return options.before_connect?.({ from, to, kind: api.get_edge_mode(), api }).ok ?? true;
        },
        [api, options],
    );

    const onConnectStart: OnConnectStart = useCallback(
        (_event, data) => {
            if (data.nodeId !== null) api.start_wire(data.nodeId, api.get_edge_mode());
        },
        [api],
    );
    const onConnectEnd: OnConnectEnd = useCallback(() => api.cancel_wire(), [api]);
    const onConnect: OnConnect = useCallback(
        (connection) => {
            if (options.can_edit === false) {
                options.on_permission_denied?.('Editing is disabled by workspace permissions.', { action: 'canvas-connect' });
                api.cancel_wire();
                return;
            }
            const from = connection.source;
            const to = connection.target;
            if (from === null || to === null || !isValidConnection(connection)) {
                api.cancel_wire();
                return;
            }
            api.start_wire(from, api.get_edge_mode());
            api.commit_wire(to);
        },
        [api, isValidConnection, options],
    );
    const onMoveEnd: OnMoveEnd = useCallback((_event, viewport) => api.set_viewport(viewport), [api]);

    return {
        nodes: model.nodes,
        edges: model.edges,
        onNodesChange,
        onNodeDragStop,
        onEdgesChange,
        onConnect,
        onConnectStart,
        onConnectEnd,
        onMoveEnd,
        isValidConnection,
        snap_to_grid: snapVector !== undefined,
        snap_grid: snapVector,
    };
}
