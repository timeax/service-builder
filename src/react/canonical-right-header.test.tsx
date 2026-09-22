// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor, WORKSPACE_ID } from '../../backend/canonical/seed/meta';
import { CanonicalRightHeader } from './canonical-right-header';
import { ServiceBuilderProvider } from './workspace';

describe('canonical right header', () => {
    it('preserves collaborator, preview, and share controls with canonical payloads', async () => {
        const onPlay = vi.fn();
        const onShare = vi.fn();

        render(
            <ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}>
                <CanonicalRightHeader onPlay={onPlay} onShare={onShare} />
            </ServiceBuilderProvider>,
        );

        const preview = await screen.findByTitle('Preview current branch');
        fireEvent.click(preview);
        expect(onPlay).toHaveBeenCalledOnce();
        expect(onPlay.mock.calls[0]![0]).toMatchObject({
            workspace_id: WORKSPACE_ID,
            branch_id: 'branch:main',
            definition: { schema_version: '1' },
        });
        expect(onPlay.mock.calls[0]![0].services.length).toBeGreaterThan(0);

        fireEvent.click(screen.getByTitle('Share branch'));
        expect(onShare).toHaveBeenCalledOnce();
        expect(onShare.mock.calls[0]![0]).toMatchObject({ schema_version: '1' });

        fireEvent.click(screen.getAllByRole('button')[0]!);
        await waitFor(() => expect(screen.getByText('Branch authors')).toBeInTheDocument());
        expect(screen.getByText('Davy')).toBeInTheDocument();
        expect(screen.getByText(/owner/i)).toBeInTheDocument();
    });
});
