// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalAssets } from './canonical-assets';
import { ServiceBuilderProvider, useWorkspaceSelector } from './workspace';

vi.mock('@elqora/dgp-ordering-form-palette', () => ({ BUILT_IN_INPUT_TYPES: ['text', 'select', 'number'] }));
vi.mock('@timeax/form-palette', () => ({
    InputField: ({ value, placeholder, onChange, trailingControl }: any) => (
        <label>
            <input value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange?.({ value: event.target.value })} />
            {trailingControl}
        </label>
    ),
}));

describe('canonical assets', () => {
    it('preserves built-in and saved-template cards from canonical registries and Workspace', async () => {
        render(
            <ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}>
                <CanonicalAssets />
            </ServiceBuilderProvider>,
        );
        expect(await screen.findByText('Built-in Inputs')).toBeInTheDocument();
        expect(screen.getByText('Saved Templates')).toBeInTheDocument();
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Target URL')).toBeInTheDocument();
    });

    it('clones a saved field template through WorkspaceRuntime', async () => {
        function TemplateCount() {
            const count = useWorkspaceSelector((state) => state.templates.length);
            return <output aria-label="Template count">{count}</output>;
        }
        render(
            <ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}>
                <CanonicalAssets />
                <TemplateCount />
            </ServiceBuilderProvider>,
        );
        await waitFor(() => expect(screen.getByLabelText('Template count')).toHaveTextContent('2'));
        fireEvent.contextMenu(screen.getByText('Target URL').closest('button')!);
        fireEvent.click(await screen.findByRole('button', { name: 'Clone template' }));
        fireEvent.change(await screen.findByPlaceholderText('Template name'), { target: { value: 'Target URL Copy' } });
        fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
        await waitFor(() => expect(screen.getByLabelText('Template count')).toHaveTextContent('3'));
        expect(screen.getByText('Target URL Copy')).toBeInTheDocument();
    });

    it('keeps assets visible while explaining denied definition mutations', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: {
                ...workspaceSeed.permissions,
                'document.mutate': false,
            },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <CanonicalAssets />
            </ServiceBuilderProvider>,
        );

        const builtIn = await screen.findByRole('button', { name: /Text text/ });
        expect(builtIn).toHaveAttribute('draggable', 'false');
        expect(builtIn).toHaveAttribute('title', 'You do not have permission to edit this definition.');
    });
});
