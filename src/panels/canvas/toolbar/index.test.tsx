import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { Toolbar } from './index.tsx';

function createApiMock() {
    let relation: 'bind' | 'include' | 'exclude' = 'bind';
    return {
        getSelection: () => [],
        getEdgeRel: () => relation,
        setEdgeRel: (next: 'bind' | 'include' | 'exclude') => {
            relation = next;
        },
        emit: vi.fn(),
    };
}

function ToolbarHarness() {
    const api = createApiMock() as any;
    const [showGrid, setShowGrid] = useState(true);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const [showBindEdges, setShowBindEdges] = useState(true);
    const [showIncludeEdges, setShowIncludeEdges] = useState(true);
    const [showExcludeEdges, setShowExcludeEdges] = useState(false);
    const [focusCurrentContext, setFocusCurrentContext] = useState(false);

    return (
        <ReactFlowProvider>
            <Toolbar
                api={api}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                showMiniMap={showMiniMap}
                setShowMiniMap={setShowMiniMap}
                showBindEdges={showBindEdges}
                setShowBindEdges={setShowBindEdges}
                showIncludeEdges={showIncludeEdges}
                setShowIncludeEdges={setShowIncludeEdges}
                showExcludeEdges={showExcludeEdges}
                setShowExcludeEdges={setShowExcludeEdges}
                focusCurrentContext={focusCurrentContext}
                setFocusCurrentContext={setFocusCurrentContext}
                labelPlacement="tooltip"
            />
        </ReactFlowProvider>
    );
}

describe('canvas toolbar view toggles', () => {
    it('reflects and toggles edge-layer visibility + focus mode', () => {
        render(<ToolbarHarness />);

        const bindButton = screen.getByTitle('Show bind edges');
        const includeButton = screen.getByTitle('Show include edges');
        const excludeButton = screen.getByTitle('Show exclude edges');
        const focusButton = screen.getByTitle('Focus current context');

        expect(bindButton).toHaveAttribute('aria-pressed', 'true');
        expect(includeButton).toHaveAttribute('aria-pressed', 'true');
        expect(excludeButton).toHaveAttribute('aria-pressed', 'false');
        expect(focusButton).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(excludeButton);
        fireEvent.click(focusButton);

        expect(excludeButton).toHaveAttribute('aria-pressed', 'true');
        expect(focusButton).toHaveAttribute('aria-pressed', 'true');
    });
});
