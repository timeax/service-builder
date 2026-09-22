// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspaceBackend } from '../../backend/canonical/create-backend';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalLayers } from './canonical-layers';
import { ServiceBuilderProvider } from './workspace';

describe('CanonicalLayers', () => {
    it('keeps the established Layers surface while editing canonical workspace state', async () => {
        render(
            <ServiceBuilderProvider backend={workspaceBackend} actor={workspaceActor}>
                <CanonicalLayers />
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByText('Tag hierarchy')).toBeInTheDocument();
        expect(screen.getByText('Fields in view')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Add field'));
        await waitFor(() => expect(screen.getByText('New Field')).toBeInTheDocument());
    });

    it('keeps the layer hierarchy browsable while explaining denied mutations', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: { ...workspaceSeed.permissions, 'document.mutate': false },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalLayers />
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByText('Tag hierarchy')).toBeInTheDocument();
        for (const name of ['Add tag', 'Add option', 'Add field']) {
            const button = screen.getByRole('button', { name });
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('title', 'You do not have permission to edit this definition.');
        }
        expect(screen.getByText('Platform')).toBeInTheDocument();
    });
});
