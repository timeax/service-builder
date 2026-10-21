// SPDX-License-Identifier: GPL-3.0-only
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalRightPanel } from './canonical-right-panel';

vi.mock('./canonical-right-header', () => ({ CanonicalRightHeader: () => <div>Right header</div> }));
vi.mock('./canonical-comments', () => ({ CanonicalComments: () => <div>Comments body</div> }));
vi.mock('./canonical-properties', () => ({ CanonicalProperties: () => <div>Properties body</div> }));
vi.mock('./canonical-wireframe', () => ({ CanonicalWireframe: () => <div>Wireframe body</div> }));

describe('canonical right panel', () => {
    it('preserves the three-tab panel composition', () => {
        render(<CanonicalRightPanel />);
        expect(screen.getByText('Right header')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Comments' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Properties' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Wireframe' })).toHaveAttribute('data-state', 'active');
        expect(screen.getByText('Wireframe body')).toBeInTheDocument();
    });
});
