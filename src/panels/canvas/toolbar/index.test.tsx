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
    it('keeps relation buttons visible and exposes view toggles via the compact popover', () => {
        render(<ToolbarHarness />);

        expect(screen.getByTitle('Bind')).toBeInTheDocument();
        expect(screen.getByTitle('Include')).toBeInTheDocument();
        expect(screen.getByTitle('Exclude')).toBeInTheDocument();

        const viewMenu = screen.getByRole('button', { name: /canvas view/i });
        expect(viewMenu).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(viewMenu);
        expect(viewMenu).toHaveAttribute('aria-expanded', 'true');

        expect(screen.getByText('Edge Layers')).toBeInTheDocument();
        expect(screen.getByText('Canvas')).toBeInTheDocument();

        const bindButton = screen.getByRole('menuitemcheckbox', { name: /bind edges/i });
        const includeButton = screen.getByRole('menuitemcheckbox', { name: /include edges/i });
        const excludeButton = screen.getByRole('menuitemcheckbox', { name: /exclude edges/i });
        const focusButton = screen.getByRole('menuitemcheckbox', { name: /focus context/i });
        const gridButton = screen.getByRole('menuitemcheckbox', { name: /^grid$/i });
        const minimapButton = screen.getByRole('menuitemcheckbox', { name: /^minimap$/i });

        expect(bindButton).toHaveAttribute('aria-checked', 'true');
        expect(includeButton).toHaveAttribute('aria-checked', 'true');
        expect(excludeButton).toHaveAttribute('aria-checked', 'false');
        expect(focusButton).toHaveAttribute('aria-checked', 'false');
        expect(gridButton).toHaveAttribute('aria-checked', 'true');
        expect(minimapButton).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(excludeButton);
        fireEvent.click(focusButton);

        expect(screen.getByRole('button', { name: /canvas view/i })).toHaveClass('border-blue-200');
        expect(screen.getByRole('menuitemcheckbox', { name: /exclude edges/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemcheckbox', { name: /focus context/i })).toHaveAttribute('aria-checked', 'true');
    });

    it('uses the same standalone button sizing for the view trigger and orientation toggle', () => {
        render(<ToolbarHarness />);

        const viewMenu = screen.getByRole('button', { name: /canvas view/i });
        const orientationToggle = screen.getByRole('button', { name: /switch to vertical toolbar/i });

        for (const className of ['h-11', 'w-11', 'rounded-2xl', '[&_svg]:h-5', '[&_svg]:w-5']) {
            expect(viewMenu).toHaveClass(className);
            expect(orientationToggle).toHaveClass(className);
        }

        fireEvent.click(viewMenu);
        const excludeButton = screen.getByRole('menuitemcheckbox', { name: /exclude edges/i });
        fireEvent.click(excludeButton);

        expect(viewMenu).toHaveAttribute('aria-expanded', 'true');
        expect(viewMenu).not.toHaveClass('ring-1');
        expect(screen.getByText(/\d+ active view options/i)).toBeInTheDocument();
    });
});
