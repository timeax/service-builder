// SPDX-License-Identifier: GPL-3.0-only
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalLeftPanel } from './canonical-left-panel';

vi.mock('./canonical-header', () => ({ CanonicalHeader: () => <div>Left header</div> }));
vi.mock('./canonical-layers', () => ({ CanonicalLayers: () => <div>Layers body</div> }));
vi.mock('./canonical-assets', () => ({ CanonicalAssets: () => <div>Assets body</div> }));

describe('canonical left panel', () => {
    it('preserves the header and Layers/Assets tab composition', () => {
        render(<CanonicalLeftPanel />);
        expect(screen.getByText('Left header')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Layers' })).toHaveAttribute('data-state', 'active');
        expect(screen.getByRole('tab', { name: 'Assets' })).toBeInTheDocument();
        expect(screen.getByText('Layers body')).toBeInTheDocument();
    });
});
