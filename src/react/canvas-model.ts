// SPDX-License-Identifier: GPL-3.0-only
import type { ProductGraphNode } from '@elqora/dgp-core';
import type { CanvasState, SynchronizedCommentThread } from '@elqora/dgp-workspace';
import type { Edge, Node } from '@xyflow/react';

export interface CanvasPoint {
    x: number;
    y: number;
}

export type ServiceBuilderNodeKind = 'tag' | 'field' | 'option';

export interface ServiceBuilderNodeData extends Record<string, unknown> {
    node: { id: string; label: string; kind: ServiceBuilderNodeKind };
}

export interface ServiceBuilderCommentData extends Record<string, unknown> {
    thread: {
        id: string;
        resolved: boolean;
        messages: Array<{ body: string; authorName?: string; isMain: boolean }>;
    };
}

function presentationKind(node: ProductGraphNode): ServiceBuilderNodeKind | undefined {
    if (node.kind === 'filter') return 'tag';
    if (node.kind === 'field' || node.kind === 'option') return node.kind;
    return undefined;
}

export function parseCanonicalCommentTarget(targetPath: string, positions: CanvasState['positions']): CanvasPoint {
    const canvas = /^canvas@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(targetPath);
    if (canvas !== null) return { x: Number(canvas[1]), y: Number(canvas[2]) };
    const nodePosition = positions[targetPath];
    if (nodePosition !== undefined) return { x: nodePosition.x + 32, y: nodePosition.y - 16 };
    return { x: 0, y: 0 };
}

export function formatCanonicalCanvasCommentTarget(point: CanvasPoint): string {
    return `canvas@${Math.round(point.x)},${Math.round(point.y)}`;
}

function commentNode(thread: SynchronizedCommentThread, state: CanvasState): Node<ServiceBuilderCommentData, 'comment'> {
    return {
        id: `comment:${thread.id}`,
        type: 'comment',
        position: parseCanonicalCommentTarget(thread.target_path, state.positions),
        draggable: true,
        selectable: true,
        data: {
            thread: {
                id: thread.id,
                resolved: thread.resolved,
                messages: thread.messages.map((message, index) => ({
                    body: message.body,
                    isMain: index === 0,
                })),
            },
        },
    };
}

export interface CanonicalReactFlowModel {
    nodes: Node[];
    edges: Edge[];
}

export function toCanonicalReactFlowModel(
    state: CanvasState,
    comments: readonly SynchronizedCommentThread[] = [],
): CanonicalReactFlowModel {
    const nodes: Node[] = state.graph.nodes.flatMap((node, index) => {
        const kind = presentationKind(node);
        if (kind === undefined) return [];
        const fallback = { x: 120 + (index % 4) * 260, y: 120 + Math.floor(index / 4) * 170 };
        const data: ServiceBuilderNodeData = { node: { id: node.id, label: node.label, kind } };
        return [{
            id: node.id,
            type: kind,
            data,
            position: state.positions[node.id] ?? fallback,
            selected: state.selection.has(node.id),
        }];
    });
    nodes.push(...comments.map((thread) => commentNode(thread, state)));

    const visibleIds = new Set(nodes.filter((node) => node.type !== 'comment').map((node) => node.id));
    const edges: Edge[] = state.graph.edges
        .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
        .map((edge) => ({
            id: edge.id,
            source: edge.from,
            target: edge.to,
            type: 'default',
            data: { edge },
        }));
    return { nodes, edges };
}
