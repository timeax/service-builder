// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { describe, expect, it } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CANONICAL_PRODUCT_DEFINITION_PROMPT, CanonicalHeader } from './canonical-header';
import { ServiceBuilderProvider } from './workspace';

describe('canonical service-builder header', () => {
    it('preserves the header and opens canonical prompts from the existing menu', async () => {
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalHeader /></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByText('Service Builder')).toBeInTheDocument());
        expect(await screen.findByText(/Active branch -/)).toHaveTextContent('main');
        fireEvent.click(screen.getByTitle('Menu'));
        fireEvent.click(await screen.findByRole('button', { name: 'Prompts' }));
        expect(await screen.findByRole('heading', { name: 'Prompts' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Copy definition' })).toBeInTheDocument();
        expect(CANONICAL_PRODUCT_DEFINITION_PROMPT).toContain('canonical DGP v1 ProductDefinition');
        expect(CANONICAL_PRODUCT_DEFINITION_PROMPT).toContain('Do not output legacy');
        const dialogSurface = screen.getByRole('heading', { name: 'Prompts' }).closest('[tabindex="-1"]');
        if (!dialogSurface) throw new Error('Prompts dialog surface is missing its keyboard target.');
        fireEvent.keyDown(dialogSurface, { key: 'Escape', code: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prompts' })).not.toBeInTheDocument());
    });
});
