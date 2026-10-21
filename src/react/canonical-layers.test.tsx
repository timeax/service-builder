// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { walkOptions } from '@elqora/dgp-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspaceBackend } from '../../backend/canonical/create-backend';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalLayers } from './canonical-layers';
import { ServiceBuilderProvider, useWorkspaceSelector } from './workspace';

function NamedOptionCount() {
    const count = useWorkspaceSelector((state) => state.definition ? [...walkOptions(state.definition)].filter((visit) => visit.option.label === 'Five').length : 0);
    return <output aria-label="Five option count">{count}</output>;
}

describe('CanonicalLayers', () => {
    it('names an option before creating it and cancels without mutation', async () => {
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalLayers /><NamedOptionCount /></ServiceBuilderProvider>);
        const add = await screen.findByRole('button', { name: 'Add option' });
        await waitFor(() => expect(add).toBeEnabled());
        fireEvent.click(add);
        fireEvent.change(screen.getByLabelText('New option name'), { target: { value: 'Five' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByLabelText('Five option count')).toHaveTextContent('0');
        fireEvent.click(add);
        fireEvent.change(screen.getByLabelText('New option name'), { target: { value: 'Five' } });
        fireEvent.click(document.querySelector('form button[type="submit"]')!);
        await waitFor(() => expect(screen.getByLabelText('Five option count')).toHaveTextContent('1'));
    });

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
