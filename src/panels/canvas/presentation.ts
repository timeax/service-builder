type GraphNode = {
    id: string;
    kind: 'tag' | 'field' | 'option' | string;
};

type GraphEdge = {
    kind: string;
    from: string;
    to: string;
};

type VisibleGroupSingle = {
    kind: 'single';
    group: {
        tagId?: string;
        fieldIds?: string[];
        parentTags?: Array<{ id: string }>;
        childrenTags?: Array<{ id: string }>;
    };
};

type VisibleGroupResult = VisibleGroupSingle | { kind: 'multi'; groups: string[] } | null | undefined;

export type RelationKind = 'bind' | 'include' | 'exclude';
export type FocusDimLevel = 'none' | 'soft' | 'medium' | 'strong';

export type CanvasViewPrefs = {
    showBindEdges: boolean;
    showIncludeEdges: boolean;
    showExcludeEdges: boolean;
    focusCurrentContext: boolean;
};

export type NodeVisualState = {
    isActiveNode: boolean;
    isCurrentTag: boolean;
    isVisibleGroupField: boolean;
    isRelatedTag: boolean;
    isManualHighlighted: boolean;
    showCurrentTagDot: boolean;
    focusDimLevel: FocusDimLevel;
};

export type EdgeVisualState = {
    kind: RelationKind | null;
    hidden: boolean;
    isContextBindEdge: boolean;
    isManualHighlighted: boolean;
    focusDimLevel: FocusDimLevel;
};

export type RelationEdgeStyle = {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    opacity?: number;
};

export type CanvasPresentation = {
    nodeStateById: Record<string, NodeVisualState>;
    edgeStateById: Record<string, EdgeVisualState>;
};

export const defaultCanvasViewPrefs: CanvasViewPrefs = {
    showBindEdges: true,
    showIncludeEdges: true,
    showExcludeEdges: false,
    focusCurrentContext: false,
};

export function parseEdgeId(edgeId: string): { kind: RelationKind; from: string; to: string } | null {
    const sep = edgeId.indexOf(':');
    if (sep < 0) return null;
    const kind = edgeId.slice(0, sep);
    const rest = edgeId.slice(sep + 1);
    if (!kind || !rest) return null;
    const [from, to] = rest.split('->');
    if (!from || !to) return null;
    if (kind !== 'bind' && kind !== 'include' && kind !== 'exclude') return null;
    return { kind, from, to };
}

export function buildEdgeId(edge: Pick<GraphEdge, 'kind' | 'from' | 'to'>): string {
    return `${edge.kind}:${edge.from}->${edge.to}`;
}

export function relationBaseStyle(kind: RelationKind): RelationEdgeStyle {
    if (kind === 'include') {
        return {
            stroke: '#0f766e',
            strokeWidth: 1.8,
            strokeDasharray: '6 5',
        };
    }

    if (kind === 'exclude') {
        return {
            stroke: '#dc2626',
            strokeWidth: 1.9,
            strokeDasharray: '8 5',
        };
    }

    return {
        stroke: '#64748b',
        strokeWidth: 1.8,
    };
}

export function edgeStyleForState(input: {
    kind: RelationKind;
    isContextBindEdge: boolean;
    isManualHighlighted: boolean;
    focusDimLevel: FocusDimLevel;
}): RelationEdgeStyle {
    const base = relationBaseStyle(input.kind);
    let next: RelationEdgeStyle = { ...base };

    if (input.isContextBindEdge) {
        next = {
            ...next,
            stroke: '#16a34a',
            strokeWidth: 2.8,
            strokeDasharray: undefined,
        };
    } else if (input.isManualHighlighted) {
        next = {
            ...next,
            stroke: '#f59e0b',
            strokeWidth: Math.max(next.strokeWidth, 2.35),
        };
    }

    if (input.focusDimLevel === 'soft') next.opacity = 0.75;
    if (input.focusDimLevel === 'medium') next.opacity = 0.45;
    if (input.focusDimLevel === 'strong') next.opacity = 0.22;

    return next;
}

export function deriveCanvasPresentation(args: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    activeId: string | null;
    currentTagId: string | null;
    visibleGroup: VisibleGroupResult;
    highlightedIds: ReadonlySet<string>;
    prefs: CanvasViewPrefs;
}): CanvasPresentation {
    const nodeIds = new Set(args.nodes.map((node) => node.id));
    const visibleFieldIds = new Set<string>();
    const relatedTagIds = new Set<string>();
    const contextTagIds = new Set<string>();

    const currentTagId =
        args.visibleGroup?.kind === 'single' && args.visibleGroup.group.tagId
            ? String(args.visibleGroup.group.tagId)
            : args.currentTagId ?? null;

    if (currentTagId) contextTagIds.add(currentTagId);

    if (args.visibleGroup?.kind === 'single') {
        for (const id of args.visibleGroup.group.fieldIds ?? []) visibleFieldIds.add(String(id));
        for (const tag of args.visibleGroup.group.parentTags ?? []) contextTagIds.add(String(tag.id));
        for (const tag of args.visibleGroup.group.childrenTags ?? []) relatedTagIds.add(String(tag.id));
    }

    if (currentTagId) {
        const childTagAdj = new Map<string, string[]>();
        for (const edge of args.edges) {
            if (edge.kind !== 'child') continue;
            if (!childTagAdj.has(edge.from)) childTagAdj.set(edge.from, []);
            childTagAdj.get(edge.from)!.push(edge.to);
        }

        const stack = [...(childTagAdj.get(currentTagId) ?? [])];
        const seen = new Set(stack);
        while (stack.length) {
            const next = stack.pop()!;
            relatedTagIds.add(next);
            const children = childTagAdj.get(next) ?? [];
            for (const child of children) {
                if (seen.has(child)) continue;
                seen.add(child);
                stack.push(child);
            }
        }
    }

    if (currentTagId) relatedTagIds.delete(currentTagId);

    const contextBindEdgeIds = new Set<string>();
    for (const edge of args.edges) {
        if (edge.kind !== 'bind') continue;
        if (!visibleFieldIds.has(edge.to)) continue;
        if (!contextTagIds.size || contextTagIds.has(edge.from)) {
            contextBindEdgeIds.add(buildEdgeId(edge));
        }
    }

    const focusNodeLevel = (node: GraphNode, state: Omit<NodeVisualState, 'focusDimLevel'>): FocusDimLevel => {
        if (!args.prefs.focusCurrentContext) return 'none';
        if (state.isCurrentTag || state.isVisibleGroupField || state.isActiveNode || state.isManualHighlighted) return 'none';
        if (state.isRelatedTag) return 'soft';
        if (node.kind === 'field' || node.kind === 'option') return 'strong';
        return 'medium';
    };

    const nodeStateById: Record<string, NodeVisualState> = {};
    for (const node of args.nodes) {
        const isActiveNode = args.activeId === node.id;
        const isCurrentTag = Boolean(currentTagId && node.id === currentTagId);
        const isVisibleGroupField = node.kind === 'field' && visibleFieldIds.has(node.id);
        const isRelatedTag = node.kind === 'tag' && relatedTagIds.has(node.id);
        const isManualHighlighted = args.highlightedIds.has(node.id);
        const base = {
            isActiveNode,
            isCurrentTag,
            isVisibleGroupField,
            isRelatedTag,
            isManualHighlighted,
            showCurrentTagDot: isCurrentTag,
        };
        nodeStateById[node.id] = {
            ...base,
            focusDimLevel: focusNodeLevel(node, base),
        };
    }

    const focusEdgeLevel = (edge: GraphEdge, state: Omit<EdgeVisualState, 'focusDimLevel'>): FocusDimLevel => {
        if (!args.prefs.focusCurrentContext) return 'none';
        if (state.isContextBindEdge || state.isManualHighlighted) return 'none';
        const sourceState = nodeStateById[edge.from];
        const targetState = nodeStateById[edge.to];
        if (sourceState?.isCurrentTag || targetState?.isCurrentTag || sourceState?.isVisibleGroupField || targetState?.isVisibleGroupField) return 'soft';
        if (sourceState?.isRelatedTag || targetState?.isRelatedTag) return 'medium';
        return 'strong';
    };

    const edgeStateById: Record<string, EdgeVisualState> = {};
    for (const edge of args.edges) {
        const edgeId = buildEdgeId(edge);
        const parsed = parseEdgeId(edgeId);
        const kind = parsed?.kind ?? null;
        const isManualHighlighted = args.highlightedIds.has(edge.from) || args.highlightedIds.has(edge.to);
        const isContextBindEdge = contextBindEdgeIds.has(edgeId);
        const hidden =
            kind === 'bind'
                ? !args.prefs.showBindEdges
                : kind === 'include'
                  ? !args.prefs.showIncludeEdges
                  : kind === 'exclude'
                    ? !args.prefs.showExcludeEdges
                    : false;

        const base = {
            kind,
            hidden,
            isContextBindEdge,
            isManualHighlighted,
        };

        edgeStateById[edgeId] = {
            ...base,
            focusDimLevel: focusEdgeLevel(edge, base),
        };
    }

    // Ensure any edge that references missing nodes still gets a stable state in maps.
    for (const edge of args.edges) {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
            const edgeId = buildEdgeId(edge);
            if (!edgeStateById[edgeId]) {
                edgeStateById[edgeId] = {
                    kind: null,
                    hidden: false,
                    isContextBindEdge: false,
                    isManualHighlighted: false,
                    focusDimLevel: args.prefs.focusCurrentContext ? 'strong' : 'none',
                };
            }
        }
    }

    return {
        nodeStateById,
        edgeStateById,
    };
}
