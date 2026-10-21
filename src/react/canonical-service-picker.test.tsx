// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSeedPersistence, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalServicePicker } from './canonical-service-picker';
import { ServiceBuilderProvider } from './workspace';

beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('canonical inspector service picker', () => {
    it('opens the ungrouped catalog option without a select-value crash', async () => {
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: createSeedPersistence() });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalServicePicker nodeId="option:instagram-followers" /></ServiceBuilderProvider>);
        fireEvent.click(await screen.findByRole('button', { name: 'Add service' }));
        fireEvent.click(screen.getByRole('button', { name: 'Service list filter' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Catalog group' }));
        fireEvent.click(screen.getByRole('combobox'));
        await waitFor(() => expect(document.querySelector('[role="combobox"]')).toHaveAttribute('aria-expanded', 'true'));
        expect(document.body).toHaveTextContent('Ungrouped');
    });
});
