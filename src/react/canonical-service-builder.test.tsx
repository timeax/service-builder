// SPDX-License-Identifier: GPL-3.0-only
import { render, screen } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalServiceBuilder } from './canonical-service-builder';

vi.mock('./canonical-left-panel', () => ({ CanonicalLeftPanel: () => <aside>Left panel</aside> }));
vi.mock('./canonical-canvas-surface', () => ({ CanonicalCanvasSurface: () => <main>Canvas panel</main> }));
vi.mock('./canonical-right-panel', () => ({ CanonicalRightPanel: () => <aside>Right panel</aside> }));
vi.mock('./canonical-bottom-panel', () => ({ useCanonicalBottomPanel: () => ({ isOpen: false, activeTab: 'console', width: 960, height: 300, toggle: vi.fn(), open: vi.fn(), close: vi.fn(), setActiveTab: vi.fn(), setWidth: vi.fn(), setHeight: vi.fn(), shortcutLabel: 'Ctrl/Cmd + J' }), CanonicalBottomConsolePanel: () => <div>Bottom console</div> }));
vi.mock('./canonical-fallbacks', () => ({ CanonicalFallbackProvider: ({ children }: { children: React.ReactNode }) => children, useOptionalCanonicalFallbacks: () => null }));
vi.mock('@timeax/form-palette', () => ({ InputField: () => <input /> }));

describe('canonical Service Builder shell', () => {
    it('preserves the established three-panel and floating-console composition', async () => {
        render(<CanonicalServiceBuilder backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor} />);
        expect(screen.getByText('Left panel')).toBeInTheDocument();
        expect(screen.getByText('Canvas panel')).toBeInTheDocument();
        expect(screen.getByText('Right panel')).toBeInTheDocument();
        expect(screen.getByText('Bottom console')).toBeInTheDocument();
        expect(await screen.findByText('Ready')).toBeInTheDocument();
    });
});
