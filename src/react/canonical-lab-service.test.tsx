// SPDX-License-Identifier: GPL-3.0-only
import type { HandlerService, ProductDefinition } from '@elqora/dgp-spec';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalProperties } from './canonical-properties';
import lab from './fixtures/instagram-likes-lab.json';
import { ServiceBuilderProvider, useCanvasAPI, useWorkspaceSelector } from './workspace';

function SelectStandardLikes() {
    const canvas = useCanvasAPI();
    const services = useWorkspaceSelector((state) => state.services);
    return <>
        <button type="button" onClick={() => canvas?.select(['t:standard'], 't:standard')}>Select Standard Likes</button>
        <output aria-label="Loaded lab services">{services.length}</output>
    </>;
}

it('resolves Standard Likes service 127 from the supplied lab data', async () => {
    const backend = new MemoryWorkspaceBackend({
        ...workspaceSeed,
        definition: lab.definition as unknown as ProductDefinition,
        services: lab.services as unknown as HandlerService[],
        persistence: undefined,
    });
    render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><SelectStandardLikes /><CanonicalProperties /></ServiceBuilderProvider>);

    await waitFor(() => expect(screen.getByLabelText('Loaded lab services')).toHaveTextContent('202'));
    fireEvent.click(screen.getByRole('button', { name: 'Select Standard Likes' }));
    expect(await screen.findByDisplayValue('Standard Likes')).toBeInTheDocument();
    const section = screen.getByRole('button', { name: 'Service' });
    expect(section).toHaveAttribute('aria-expanded', 'false');
    expect(section).toHaveTextContent('Closed');
    expect(screen.getByRole('button', { name: 'Change service' })).toHaveTextContent('Change');
    section.focus();
    expect(document.activeElement).toBe(section);
    fireEvent.click(section);
    expect(section).toHaveAttribute('aria-expanded', 'true');
    expect(section).toHaveTextContent('Open');
    expect(await screen.findByText(lab.services.find((service) => service.id === 127)!.name)).toBeInTheDocument();
});
