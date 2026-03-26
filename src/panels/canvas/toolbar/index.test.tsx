import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { Toolbar } from './index.tsx';

function createApiMock() {
    let relation: 'bind' | 'include' | 'exclude' = 'bind';
    const listeners = new Map<string, Set<() => void>>();
    const notify = (event: string) => {
        for (const listener of listeners.get(event) ?? []) listener();
    };

    return {
        getSelection: () => [],
        getEdgeRel: () => relation,
        setEdgeRel: (next: 'bind' | 'include' | 'exclude') => {
            relation = next;
            notify('edge:change');
        },
        on: (event: string, cb: () => void) => {
            const current = listeners.get(event) ?? new Set<() => void>();
            current.add(cb);
            listeners.set(event, current);
            return () => {
                current.delete(cb);
                if (current.size === 0) listeners.delete(event);
            };
        },
        emitEdgeChange: (next: 'bind' | 'include' | 'exclude') => {
            relation = next;
            notify('edge:change');
        },
        emit: vi.fn(),
    };
}

function ToolbarHarness({ api = createApiMock() }: { api?: ReturnType<typeof createApiMock> }) {
    const [showGrid, setShowGrid] = useState(true);
    const [showMiniMap, setShowMiniMap] = useState(false);
    const [showBindEdges, setShowBindEdges] = useState(true);
    const [showIncludeEdges, setShowIncludeEdges] = useState(true);
    const [showExcludeEdges, setShowExcludeEdges] = useState(false);
    const [focusCurrentContext, setFocusCurrentContext] = useState(false);

    return (
        <ReactFlowProvider>
            <Toolbar
                api={api as any}
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

        expect(screen.getByRole('button', { name: /canvas view/i })).toHaveClass('text-blue-600');
        expect(screen.getByRole('menuitemcheckbox', { name: /exclude edges/i })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemcheckbox', { name: /focus context/i })).toHaveAttribute('aria-checked', 'true');
    });

    it('uses the same standalone button sizing for the view trigger and orientation toggle', () => {
        render(<ToolbarHarness />);

        const viewMenu = screen.getByRole('button', { name: /canvas view/i });
        const orientationToggle = screen.getByRole('button', { name: /switch to vertical toolbar/i });

        for (const className of ['h-8', 'w-8']) {
            expect(viewMenu).toHaveClass(className);
            expect(orientationToggle).toHaveClass(className);
        }

        fireEvent.click(viewMenu);
        const excludeButton = screen.getByRole('menuitemcheckbox', { name: /exclude edges/i });
        fireEvent.click(excludeButton);

        expect(viewMenu).toHaveAttribute('aria-expanded', 'true');
        expect(viewMenu).toHaveClass('text-blue-600');
        expect(screen.getByText(/\d+ active view options/i)).toBeInTheDocument();
    });

    it('updates the active relation button immediately after clicking a relation tool', () => {
        render(<ToolbarHarness />);

        const bindButton = screen.getByTitle('Bind');
        const includeButton = screen.getByTitle('Include');
        const excludeButton = screen.getByTitle('Exclude');

        expect(bindButton).toHaveAttribute('aria-pressed', 'true');
        expect(includeButton).toHaveAttribute('aria-pressed', 'false');
        expect(excludeButton).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(includeButton);

        expect(bindButton).toHaveAttribute('aria-pressed', 'false');
        expect(includeButton).toHaveAttribute('aria-pressed', 'true');
        expect(excludeButton).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(excludeButton);

        expect(bindButton).toHaveAttribute('aria-pressed', 'false');
        expect(includeButton).toHaveAttribute('aria-pressed', 'false');
        expect(excludeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates the active relation button when edge:change is emitted externally', () => {
        const api = createApiMock();
        render(<ToolbarHarness api={api} />);

        const bindButton = screen.getByTitle('Bind');
        const includeButton = screen.getByTitle('Include');
        const excludeButton = screen.getByTitle('Exclude');

        expect(bindButton).toHaveAttribute('aria-pressed', 'true');

        act(() => {
            api.emitEdgeChange('include');
        });

        expect(bindButton).toHaveAttribute('aria-pressed', 'false');
        expect(includeButton).toHaveAttribute('aria-pressed', 'true');
        expect(excludeButton).toHaveAttribute('aria-pressed', 'false');
    });
});
