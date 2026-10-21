// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { describe, expect, it, vi } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalHeader, SERVICE_BUILDER_GUIDE_URL } from './canonical-header';
import { ServiceBuilderProvider } from './workspace';

describe('canonical service-builder header', () => {
    it('copies one prompt linking the guide and containing current workspace data and user instructions', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalHeader /></ServiceBuilderProvider>);
        await waitFor(() => expect(screen.getByText('Service Builder')).toBeInTheDocument());
        expect(await screen.findByText(/Active branch -/)).toHaveTextContent('main');
        fireEvent.click(screen.getByTitle('Menu'));
        fireEvent.click(await screen.findByRole('button', { name: 'Prompts' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Prompts' })).not.toBeInTheDocument());
        expect(await screen.findByRole('heading', { name: 'Prompts' })).toBeInTheDocument();
        const instructions = screen.getByRole('textbox', { name: 'Optional instructions' });
        fireEvent.change(instructions, { target: { value: 'Create a birthday greeting service.' } });
        const preview = screen.getByText((_, element) => element?.tagName === 'PRE');
        const prompt = preview.textContent ?? '';
        expect(prompt).toContain(SERVICE_BUILDER_GUIDE_URL);
        expect(prompt).not.toContain('interface ProductDefinition');
        expect(prompt).toContain('"handler_services":');
        expect(prompt).toContain('"current_definition":');
        expect(prompt).toContain('"current_catalog":');
        expect(prompt).toContain('"templates":');
        expect(prompt).toContain('"policy_rules":');
        expect(prompt).toContain('Create a birthday greeting service.');
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Copy full prompt' }));
        await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(prompt));
        const dialogSurface = screen.getByRole('heading', { name: 'Prompts' }).closest('[tabindex="-1"]');
        if (!dialogSurface) throw new Error('Prompts dialog surface is missing its keyboard target.');
        fireEvent.keyDown(dialogSurface, { key: 'Escape', code: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prompts' })).not.toBeInTheDocument());
    });
});
