// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalDrafts } from './canonical-drafts';
import { ServiceBuilderProvider, useWorkspaceSelector } from './workspace';

function CurrentBranch() {
    const branch = useWorkspaceSelector((state) => state.branches.find((item) => item.id === state.current_branch_id));
    return <output aria-label="Current branch">{branch?.name}</output>;
}

describe('canonical branch manager', () => {
    it('creates and switches to a normalized branch through WorkspaceRuntime', async () => {
        render(
            <ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}>
                <CanonicalDrafts trigger={<button type="button">Open branches</button>} />
                <CurrentBranch />
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Current branch')).toHaveTextContent('main'));
        fireEvent.click(screen.getByRole('button', { name: 'Open branches' }));
        expect(await screen.findByText('Branch manager')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));
        fireEvent.change(await screen.findByLabelText('Branch name'), { target: { value: 'Feature Checkout' } });
        const createButtons = screen.getAllByRole('button', { name: 'Create branch' });
        fireEvent.click(createButtons.at(-1)!);
        await waitFor(() => expect(screen.getByLabelText('Current branch')).toHaveTextContent('feature-checkout'));
    });

    it('keeps branches readable while explaining denied branch creation', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: { ...workspaceSeed.permissions, 'branch.create': false },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalDrafts trigger={<button type="button">Open branches</button>} />
            </ServiceBuilderProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Open branches' }));
        expect(await screen.findByText('Branch manager')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Create branch' }));
        expect(await screen.findByText('Branch creation is disabled by workspace permissions.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Branch name'), { target: { value: 'blocked-branch' } });
        expect(screen.getAllByRole('button', { name: 'Create branch' }).at(-1)).toBeDisabled();
    });
});
