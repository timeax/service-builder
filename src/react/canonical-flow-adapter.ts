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
    type OnNodesChange,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCanonicalCanvasCommentTarget, toCanonicalReactFlowModel } from './canvas-model';

export interface CanonicalFlowAdapterOptions {
    can_edit?: boolean;
    snap_to_grid?: boolean | { x: number; y: number };
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

    useEffect(() => {
        void commentsRevision;
        setModel(project());
        const refresh = () => setModel(project());
        const offState = api.on('state:change', refresh);
        const offComments = api.on('comments:change', refresh);
        return () => {
            offState();
            offComments();
        };
    }, [api, commentsRevision, project]);

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

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            if (options.can_edit === false && changes.some((change) => change.type === 'position' || change.type === 'remove')) {
                options.on_permission_denied?.('Editing is disabled by workspace permissions.', { action: 'canvas-node-change' });
                setModel(project());
                return;
            }
            setModel((current) => {
                const nodes = applyNodeChanges(changes, current.nodes);
                const positions = { ...api.snapshot().positions };
                let positionChanged = false;
                let selectionChanged = false;
                for (const change of changes) {
                    if (change.type === 'position' && change.position !== undefined) {
                        const point = snap(change.position);
                        if (isCommentNode(change.id)) {
                            const threadId = change.id.slice('comment:'.length);
                            api.comments.move(threadId, formatCanonicalCanvasCommentTarget(point));
                        } else {
                            positions[change.id] = point;
                            positionChanged = true;
                        }
                    }
                    if (change.type === 'select') selectionChanged = true;
                }
                if (positionChanged) api.set_positions(positions);
                if (selectionChanged) {
                    const ids = nodes.filter((node) => !isCommentNode(node.id) && node.selected).map((node) => node.id);
                    api.select(ids, ids.at(-1));
                    const comment = nodes.find((node) => isCommentNode(node.id) && node.selected);
                    api.select_comment(comment?.id.slice('comment:'.length));
                }
                return { ...current, nodes };
            });
        },
        [api, options, project, snap],
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            if (options.can_edit === false && changes.some((change) => change.type === 'remove')) {
                options.on_permission_denied?.('Editing is disabled by workspace permissions.', { action: 'canvas-edge-change' });
                setModel(project());
                return;
            }
            setModel((current) => {
                for (const change of changes) {
                    if (change.type !== 'remove') continue;
                    const edge = current.edges.find((candidate) => candidate.id === change.id);
                    const relation = edge === undefined ? undefined : relationEdge(edge);
                    if (relation !== undefined) api.editor.disconnect(relation.kind, relation.from, relation.to);
                }
                return { ...current, edges: applyEdgeChanges(changes, current.edges) };
            });
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
