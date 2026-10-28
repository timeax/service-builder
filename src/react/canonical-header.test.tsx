// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalHeader } from './canonical-header';
import { ServiceBuilderProvider } from './workspace';

describe('canonical service-builder header', () => {
    it('omits the built-in Prompts item and keeps caller-provided menu commands', async () => {
        const customCommand = vi.fn();
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalHeader menu={[{ name: 'Custom action', command: customCommand }]} /></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByText('Service Builder')).toBeInTheDocument());
        expect(await screen.findByText(/Active branch -/)).toHaveTextContent('main');
        fireEvent.click(screen.getByTitle('Menu'));
        expect(screen.queryByRole('button', { name: 'Prompts' })).not.toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: 'Custom action' }));
        await waitFor(() => expect(customCommand).toHaveBeenCalledOnce());
    });
});
