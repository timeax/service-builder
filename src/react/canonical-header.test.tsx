// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalFallbackProvider } from './canonical-fallbacks';
import { CanonicalHeader } from './canonical-header';
import { ServiceBuilderProvider } from './workspace';

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('canonical service-builder header', () => {
    it('omits the built-in Prompts item and keeps caller-provided menu commands', async () => {
        const customCommand = vi.fn();
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalFallbackProvider><CanonicalHeader menu={[{ name: 'Custom action', command: customCommand }]} /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByText('Service Builder')).toBeInTheDocument());
        expect(await screen.findByText(/Active branch -/)).toHaveTextContent('main');
        fireEvent.click(screen.getByTitle('Menu'));
        expect(screen.queryByRole('button', { name: 'Prompts' })).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: 'Custom action' }));
        await waitFor(() => expect(customCommand).toHaveBeenCalledOnce());
    });

    it('opens the full fallback editor from the header menu without a preselected service', async () => {
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalFallbackProvider><CanonicalHeader /></CanonicalFallbackProvider></ServiceBuilderProvider>);
        fireEvent.click(await screen.findByTitle('Menu'));
        fireEvent.click(await screen.findByRole('button', { name: 'Fallback editor' }));
        expect(await screen.findByRole('heading', { name: 'Fallback editor', level: 2 })).toBeInTheDocument();
        expect(screen.getByText('Choose the primary service whose fallback registrations you want to edit.')).toBeInTheDocument();
    }, 15_000);
});
