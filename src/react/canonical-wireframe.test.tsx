// SPDX-License-Identifier: GPL-3.0-only
import { render, screen } from '@testing-library/react';
import { createInputRegistry } from '@elqora/dgp-ordering';
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { describe, expect, it, vi } from 'vitest';
import { definition, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalWireframe } from './canonical-wireframe';
import { ServiceBuilderProvider } from './workspace';

vi.mock('@elqora/dgp-ordering-form-palette', () => ({
    createDefaultFormPaletteRegistry: () => createInputRegistry(),
    FormPaletteOrderingProvider: ({ children }: { children: React.ReactNode }) => children,
    OrderingInput: ({ field }: any) => <div>Input: {field.label}</div>,
}));

describe('canonical wireframe', () => {
    it('keeps the authored notice color on a visible tag label', async () => {
        const withNotice = {
            ...structuredClone(definition),
            notices: [{
                id: 'notice:color', type: 'public' as const, kind: 'label' as const, severity: 'info' as const,
                target: { scope: 'node' as const, node_kind: 'tag' as const, node_id: 'filter:platform' },
                title: 'Delivery note', meta: { color: 'amber' },
            }],
        };
        const backend = new MemoryWorkspaceBackend({ ...workspaceSeed, definition: withNotice, persistence: undefined });
        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalWireframe /></ServiceBuilderProvider>);
        expect(await screen.findByText('Delivery note')).toHaveClass('bg-amber-100');
    });

    it('preserves visible inputs and the order preview footer over OrderingSession', async () => {
        render(<ServiceBuilderProvider backend={new MemoryWorkspaceBackend(workspaceSeed)} actor={workspaceActor}><CanonicalWireframe /></ServiceBuilderProvider>);
        expect(await screen.findByText('Input: Service')).toBeInTheDocument();
        expect(screen.getByText('Input: Target URL')).toBeInTheDocument();
        expect(screen.getByText('Order preview summary')).toBeInTheDocument();
        expect(screen.getByText('Visible fields:')).toBeInTheDocument();
    });

    it('presents a canonical expression failure without presenting a completed snapshot', async () => {
        const invalidDefinition = structuredClone(definition);
        const quantityField = invalidDefinition.fields.find((field) => field.id === 'field:quantity');
        const targetField = invalidDefinition.fields.find((field) => field.id === 'field:url');
        if (!quantityField) throw new Error('The canonical seed must include the quantity field.');
        if (!targetField) throw new Error('The canonical seed must include the target field.');
        targetField.required = false;
        quantityField.quantity = {
            value_by: 'eval',
            expression: {
                language: 'javascript',
                body: 'throw new Error("Quantity configuration failed");',
            },
        };
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            definition: invalidDefinition,
            persistence: undefined,
        });

        render(<ServiceBuilderProvider backend={backend} actor={workspaceActor}><CanonicalWireframe /></ServiceBuilderProvider>);

        expect(await screen.findByText('The browser JavaScript expression failed during execution.')).toBeInTheDocument();
        expect(screen.getByText('Quantity:').parentElement).toHaveTextContent('Quantity:--');
    });
});
