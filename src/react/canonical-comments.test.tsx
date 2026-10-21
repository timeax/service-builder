// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSeedPersistence, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalComments } from './canonical-comments';
import { ServiceBuilderProvider } from './workspace';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ value, placeholder, onChange, onKeyDown, trailingControl }: any) => (
        <div>
            <textarea
                aria-label={placeholder}
                value={value ?? ''}
                onChange={(event) => onChange?.({ value: event.target.value })}
                onKeyDown={onKeyDown}
            />
            {trailingControl}
        </div>
    ),
}));

function createIsolatedBackend() {
    return new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: createSeedPersistence() });
}

class FailingCommentsBackend extends MemoryWorkspaceBackend {
    override async save_comment() {
        return {
            ok: false as const,
            error: {
                code: 'comment_sync_failed',
                message: 'The review note could not be saved.',
                retryable: true,
                meta: {},
            },
        };
    }
}

describe('canonical comments', () => {
    it('preserves the comments tab and persists a canonical thread', async () => {
        const backend = createIsolatedBackend();
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalComments />
            </ServiceBuilderProvider>,
        );
        expect(await screen.findByText('All comments')).toBeInTheDocument();
        const input = screen.getByLabelText('Add a new branch comment...');
        fireEvent.change(input, { target: { value: 'Canonical review note' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
        await waitFor(() => expect(screen.getByText('Canonical review note')).toBeInTheDocument());
    });

    it('submits a reply with Enter through the preserved comment input', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalComments />
            </ServiceBuilderProvider>,
        );
        const reply = (await screen.findAllByLabelText('Add a reply...'))[0];
        fireEvent.change(reply!, { target: { value: 'Keyboard reply' } });
        fireEvent.keyDown(reply!, { key: 'Enter', code: 'Enter' });
        await waitFor(() => expect(screen.getByText('Keyboard reply')).toBeInTheDocument());
    });

    it('presents canonical comment synchronization failures in the preserved panel', async () => {
        const backend = new FailingCommentsBackend({ ...workspaceSeed, persistence: createSeedPersistence() });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalComments />
            </ServiceBuilderProvider>,
        );
        const input = await screen.findByLabelText('Add a new branch comment...');
        fireEvent.change(input, { target: { value: 'Unsaved review note' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Comment sync failed. The review note could not be saved.');
    });

    it('keeps comments readable while explaining denied comment creation', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: { ...workspaceSeed.permissions, 'comment.write': false },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalComments />
            </ServiceBuilderProvider>,
        );

        expect(await screen.findByText('All comments')).toBeInTheDocument();
        const addComment = screen.getByRole('button', { name: 'Add comment' });
        expect(addComment).toBeDisabled();
        expect(addComment).toHaveAttribute('title', 'You do not have permission to add comments.');
    });
});
