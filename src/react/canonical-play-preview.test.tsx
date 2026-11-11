// SPDX-License-Identifier: GPL-3.0-only
import type { HandlerService, ProductDefinition } from '@elqora/dgp-spec';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { CanonicalPlayPreviewBody } from './canonical-play-preview';
import lab from './fixtures/instagram-likes-lab.json';

beforeAll(() => {
    class MockPointerEvent extends MouseEvent {
        pointerId = 1;
        pointerType = 'mouse';
    }
    vi.stubGlobal('PointerEvent', MockPointerEvent);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

it('updates Play bounds when a tag option binds a different service', async () => {
    render(
        <CanonicalPlayPreviewBody
            payload={{
                definition: lab.definition as unknown as ProductDefinition,
                services: lab.services as unknown as HandlerService[],
                workspace_id: 'instagram-likes-lab',
            }}
        />,
    );

    expect(screen.getByLabelText('Order preview summary')).toHaveTextContent('Min: 10 Max: 10000000');
    fireEvent.click(screen.getByRole('button', { name: 'Quality' }));
    const premium = await screen.findByRole('radio', { name: 'Premium' });
    fireEvent.click(premium);
    expect(premium).toBeChecked();
    expect(screen.getByLabelText('Order preview summary')).toHaveTextContent('Selected options: o:quality:premium');

    await waitFor(() => expect(screen.getByLabelText('Order preview summary')).toHaveTextContent('Min: 50 Max: 60000'));
    expect(screen.getByLabelText('Order preview summary')).toHaveTextContent('Services: 141');
});

it('renders the fields and options resolved by the OrderPreview visibility result', async () => {
    const definition = structuredClone(lab.definition) as unknown as ProductDefinition;
    const linkField = definition.fields.find((field) => field.id === 'f:link');
    const qualityField = definition.fields.find((field) => field.id === 'f:quality');
    if (!linkField || !qualityField?.options?.length) throw new Error('The Play fixture must include link and quality fields.');
    linkField.visibility_expression = { language: 'javascript', body: 'false' };
    qualityField.options.find((option) => option.id === 'o:quality:premium')!.visibility_expression = {
        language: 'javascript',
        body: 'false',
    };

    render(
        <CanonicalPlayPreviewBody
            payload={{
                definition,
                services: lab.services as unknown as HandlerService[],
                workspace_id: 'instagram-likes-lab',
            }}
        />,
    );

    expect(await screen.findByLabelText('Order preview summary')).toBeInTheDocument();
    expect(screen.queryByText('Link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quality' }));
    expect(await screen.findByRole('radio', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Premium' })).not.toBeInTheDocument();
});
