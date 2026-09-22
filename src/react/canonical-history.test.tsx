// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalHistoryPanel } from './canonical-history';
import { ServiceBuilderProvider, useWorkspaceRuntime, useWorkspaceSelector } from './workspace';

function HistoryProbe() {
    const runtime = useWorkspaceRuntime();
    const count = useRef(0);
    const state = useWorkspaceSelector((current) => current);
    const label = state.definition?.filters.find((filter) => filter.id === 'filter:platform')?.label;
    return (
        <>
            <button type="button" onClick={() => runtime.editor?.relabel('filter:platform', `Edited ${++count.current}`)}>
                Edit definition
            </button>
            <output aria-label="History state">
                {label}|{state.snapshot_state}|{state.commits.length}
            </output>
        </>
    );
}

describe('canonical version history', () => {
    it('creates a commit and restores an earlier snapshot through WorkspaceRuntime', async () => {
        render(
            <ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}>
                <HistoryProbe />
                <CanonicalHistoryPanel onClose={() => undefined} />
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('History state')).toHaveTextContent('Platform|clean|1'));

        fireEvent.click(screen.getByRole('button', { name: 'Edit definition' }));
        await waitFor(() => expect(screen.getByLabelText('History state')).toHaveTextContent('Edited 1|dirty|1'));
        fireEvent.click(screen.getByRole('button', { name: 'Create commit' }));
        await waitFor(() => expect(screen.getByLabelText('History state')).toHaveTextContent('Edited 1|clean|2'));

        fireEvent.click(screen.getByRole('button', { name: 'Edit definition' }));
        fireEvent.click(screen.getByRole('button', { name: 'Restore Initial main seed' }));
        await waitFor(() => expect(screen.getByLabelText('History state')).toHaveTextContent('Platform|dirty|2'));
    });

    it('keeps history readable while explaining denied history mutations', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: {
                ...workspaceSeed.permissions,
                'commit.create': false,
                'draft.save': false,
                'document.mutate': false,
            },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalHistoryPanel onClose={() => undefined} />
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByText('Version history')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create commit' })).toHaveAttribute('title', 'You do not have permission to create commits.');
        expect(screen.getByRole('button', { name: 'Discard draft' })).toHaveAttribute('title', 'You do not have permission to discard drafts.');
        expect(screen.getByText('No commits exist for this branch.')).toBeInTheDocument();
    });
});
