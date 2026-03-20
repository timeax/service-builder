import { defaultCanvasViewPrefs, deriveCanvasPresentation, edgeStyleForState, relationBaseStyle } from './presentation.ts';

describe('canvas presentation', () => {
    it('maps relation kinds to distinct base styles', () => {
        const bind = relationBaseStyle('bind');
        const include = relationBaseStyle('include');
        const exclude = relationBaseStyle('exclude');

        expect(bind.strokeDasharray).toBeUndefined();
        expect(include.strokeDasharray).toContain('6');
        expect(exclude.strokeDasharray).toContain('8');
        expect(exclude.stroke).toBe('#dc2626');
    });

    it('hides exclude edges by default and keeps include visible', () => {
        const presentation = deriveCanvasPresentation({
            nodes: [
                { id: 't:root', kind: 'tag' },
                { id: 'f:a', kind: 'field' },
                { id: 'f:b', kind: 'field' },
            ],
            edges: [
                { kind: 'include', from: 't:root', to: 'f:a' },
                { kind: 'exclude', from: 't:root', to: 'f:b' },
            ],
            activeId: null,
            currentTagId: 't:root',
            visibleGroup: { kind: 'single', group: { tagId: 't:root', fieldIds: ['f:a'] } },
            highlightedIds: new Set<string>(),
            prefs: defaultCanvasViewPrefs,
        });

        expect(presentation.edgeStateById['include:t:root->f:a'].hidden).toBe(false);
        expect(presentation.edgeStateById['exclude:t:root->f:b'].hidden).toBe(true);
    });

    it('keeps active node, current tag, visible group, related tag, and manual highlight separate', () => {
        const presentation = deriveCanvasPresentation({
            nodes: [
                { id: 't:parent', kind: 'tag' },
                { id: 't:current', kind: 'tag' },
                { id: 't:child', kind: 'tag' },
                { id: 'f:visible', kind: 'field' },
                { id: 'f:active', kind: 'field' },
                { id: 'f:manual', kind: 'field' },
            ],
            edges: [
                { kind: 'child', from: 't:parent', to: 't:current' },
                { kind: 'child', from: 't:current', to: 't:child' },
                { kind: 'bind', from: 't:current', to: 'f:visible' },
            ],
            activeId: 'f:active',
            currentTagId: 't:current',
            visibleGroup: {
                kind: 'single',
                group: {
                    tagId: 't:current',
                    fieldIds: ['f:visible'],
                    parentTags: [{ id: 't:parent' }],
                    childrenTags: [{ id: 't:child' }],
                },
            },
            highlightedIds: new Set(['f:manual']),
            prefs: { ...defaultCanvasViewPrefs, focusCurrentContext: true },
        });

        expect(presentation.nodeStateById['t:current'].isCurrentTag).toBe(true);
        expect(presentation.nodeStateById['t:current'].showCurrentTagDot).toBe(true);
        expect(presentation.nodeStateById['f:active'].isActiveNode).toBe(true);
        expect(presentation.nodeStateById['f:active'].isCurrentTag).toBe(false);
        expect(presentation.nodeStateById['f:visible'].isVisibleGroupField).toBe(true);
        expect(presentation.nodeStateById['t:child'].isRelatedTag).toBe(true);
        expect(presentation.nodeStateById['f:manual'].isManualHighlighted).toBe(true);
        expect(presentation.nodeStateById['f:manual'].focusDimLevel).toBe('none');
    });

    it('highlights context bind edges and dims unrelated edges in focus mode', () => {
        const presentation = deriveCanvasPresentation({
            nodes: [
                { id: 't:current', kind: 'tag' },
                { id: 't:other', kind: 'tag' },
                { id: 'f:visible', kind: 'field' },
                { id: 'f:other', kind: 'field' },
            ],
            edges: [
                { kind: 'bind', from: 't:current', to: 'f:visible' },
                { kind: 'bind', from: 't:other', to: 'f:other' },
            ],
            activeId: null,
            currentTagId: 't:current',
            visibleGroup: { kind: 'single', group: { tagId: 't:current', fieldIds: ['f:visible'] } },
            highlightedIds: new Set<string>(),
            prefs: { ...defaultCanvasViewPrefs, focusCurrentContext: true },
        });

        expect(presentation.edgeStateById['bind:t:current->f:visible'].isContextBindEdge).toBe(true);
        expect(presentation.edgeStateById['bind:t:other->f:other'].focusDimLevel).toBe('strong');

        const contextStyle = edgeStyleForState({
            kind: 'bind',
            isContextBindEdge: true,
            isManualHighlighted: false,
            focusDimLevel: 'none',
        });
        const unrelatedStyle = edgeStyleForState({
            kind: 'bind',
            isContextBindEdge: false,
            isManualHighlighted: false,
            focusDimLevel: 'strong',
        });

        expect(contextStyle.stroke).toBe('#16a34a');
        expect(unrelatedStyle.opacity).toBe(0.22);
    });

    it('updates current-tag and visible-group highlight immediately when selection context changes', () => {
        const nodes = [
            { id: 't:a', kind: 'tag' as const },
            { id: 't:b', kind: 'tag' as const },
            { id: 'f:a', kind: 'field' as const },
            { id: 'f:b', kind: 'field' as const },
        ];
        const edges = [
            { kind: 'bind', from: 't:a', to: 'f:a' },
            { kind: 'bind', from: 't:b', to: 'f:b' },
        ];

        const aState = deriveCanvasPresentation({
            nodes,
            edges,
            activeId: 't:a',
            currentTagId: 't:a',
            visibleGroup: { kind: 'single', group: { tagId: 't:a', fieldIds: ['f:a'] } },
            highlightedIds: new Set<string>(),
            prefs: defaultCanvasViewPrefs,
        });
        const bState = deriveCanvasPresentation({
            nodes,
            edges,
            activeId: 't:b',
            currentTagId: 't:b',
            visibleGroup: { kind: 'single', group: { tagId: 't:b', fieldIds: ['f:b'] } },
            highlightedIds: new Set<string>(),
            prefs: defaultCanvasViewPrefs,
        });

        expect(aState.nodeStateById['t:a'].isCurrentTag).toBe(true);
        expect(aState.nodeStateById['f:a'].isVisibleGroupField).toBe(true);
        expect(aState.nodeStateById['t:b'].isCurrentTag).toBe(false);

        expect(bState.nodeStateById['t:b'].isCurrentTag).toBe(true);
        expect(bState.nodeStateById['f:b'].isVisibleGroupField).toBe(true);
        expect(bState.nodeStateById['t:a'].isCurrentTag).toBe(false);
    });
});
