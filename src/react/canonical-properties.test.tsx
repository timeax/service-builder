// SPDX-License-Identifier: GPL-3.0-only
import { MemoryWorkspaceBackend } from '@elqora/dgp-workspace';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createSeedPersistence, workspaceSeed } from '../../backend/canonical/seed';
import { workspaceActor } from '../../backend/canonical/seed/meta';
import { CanonicalProperties } from './canonical-properties';
import { ServiceBuilderProvider, useCanvasAPI, useWorkspaceSelector } from './workspace';

vi.mock('@elqora/dgp-ordering-form-palette', () => ({
    BUILT_IN_INPUT_TYPES: ['text', 'number', 'select'],
    createDefaultFormPaletteRegistry: () => ({
        resolve: (type: string) => ({
            type,
            variant: 'default',
            default_props: { fullWidth: true, slotChar: '_' },
            ui: {
                fullWidth: { type: 'boolean', label: 'Full width', description: 'Fill the available width.' },
                slotChar: { type: 'any', label: 'Slot char', description: 'Mask placeholder character.' },
            },
        }),
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    Form: ({ children, onSubmit }: any) => (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit?.({ formData: { constraints: { refill: true, cancel: false } } });
            }}
        >
            {children}
        </form>
    ),
    InputField: ({ label, value, disabled, onChange, onFocus, onBlur, onKeyDown }: any) => {
        const ariaLabel = typeof label === 'string' ? label : (label?.props?.children ?? 'input-field');
        return (
            <input
                aria-label={ariaLabel}
                value={value ?? ''}
                disabled={disabled}
                onChange={(event) => onChange?.({ value: event.target.value })}
                onFocus={onFocus}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
            />
        );
    },
}));

function CurrentLabel() {
    const label = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.label);
    return <output aria-label="Current field label">{label}</output>;
}

function CurrentQuantity() {
    const quantity = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.quantity_default);
    return <output aria-label="Current field quantity">{quantity ?? 'unset'}</output>;
}

function CurrentQuantityRule() {
    const quantity = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.quantity);
    return <output aria-label="Current field quantity rule">{JSON.stringify(quantity ?? null)}</output>;
}

function CurrentService() {
    const service = useWorkspaceSelector((state) => {
        const field = state.definition?.fields.find((candidate) => candidate.id === 'field:service');
        return field?.button === true ? field.service_id : undefined;
    });
    return <output aria-label="Current field service">{service ?? 'unset'}</output>;
}

function CurrentAdvancedProperties() {
    const values = useWorkspaceSelector((state) => {
        const definition = state.definition;
        const field = definition?.fields.find((candidate) => candidate.id === 'field:service');
        return {
            validation: field?.validation ?? [],
            includes: definition?.includes_for_buttons['field:service'] ?? [],
            optionEffects: definition?.option_effects_for_buttons['field:service'] ?? {},
            valueEffects: definition?.value_effects_for_triggers['field:service'] ?? {},
        };
    });
    return <output aria-label="Current advanced properties">{JSON.stringify(values)}</output>;
}

function CurrentUtility() {
    const utility = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.utility);
    return <output aria-label="Current utility">{JSON.stringify(utility ?? null)}</output>;
}

function CurrentDefaults() {
    const defaults = useWorkspaceSelector((state) => state.definition?.fields.find((field) => field.id === 'field:service')?.defaults);
    return <output aria-label="Current field defaults">{JSON.stringify(defaults ?? {})}</output>;
}

function SelectFilter() {
    const canvas = useCanvasAPI();
    return (
        <button type="button" onClick={() => canvas?.select(['filter:platform'], 'filter:platform')}>
            Select platform filter
        </button>
    );
}

function SelectServiceField() {
    const canvas = useCanvasAPI();
    return (
        <button type="button" onClick={() => canvas?.select(['field:service'], 'field:service')}>
            Select service field
        </button>
    );
}

function CurrentCapabilities() {
    const capabilities = useWorkspaceSelector((state) => state.definition?.filters.find((filter) => filter.id === 'filter:platform')?.capabilities);
    return <output aria-label="Current capabilities">{JSON.stringify(capabilities ?? {})}</output>;
}

function createIsolatedBackend() {
    return new MemoryWorkspaceBackend({ ...workspaceSeed, persistence: createSeedPersistence() });
}

describe('canonical properties', () => {
    it('preserves the inspector surface while mutating the canonical Editor', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalProperties />
                <CurrentLabel />
            </ServiceBuilderProvider>,
        );
        expect(await screen.findByText('Selection overview')).toBeInTheDocument();
        expect(screen.getByText('Field identity')).toBeInTheDocument();
        const label = screen.getByLabelText('Label');
        fireEvent.change(label, { target: { value: 'Delivery service' } });
        await waitFor(() => expect(screen.getByLabelText('Current field label')).toHaveTextContent('Delivery service'));
        expect(screen.getByLabelText('ID')).toHaveValue('field:service');
    });

    it('keeps selected properties readable while explaining denied edits', async () => {
        const backend = new MemoryWorkspaceBackend({
            ...workspaceSeed,
            permissions: { ...workspaceSeed.permissions, 'document.mutate': false },
            persistence: undefined,
        });
        render(
            <ServiceBuilderProvider backend={backend} actor={workspaceActor}>
                <SelectServiceField />
                <CanonicalProperties />
            </ServiceBuilderProvider>,
        );

        await screen.findByText('No active node selected');
        fireEvent.click(screen.getByRole('button', { name: 'Select service field' }));
        const heading = await screen.findByText('Selection overview');
        expect(screen.getByLabelText('Label')).toBeDisabled();
        expect(heading.closest('[title]')).toHaveAttribute('title', 'You do not have permission to edit this definition.');
    });

    it('edits canonical quantity behavior through the preserved collapsible section', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalProperties />
                <CurrentQuantity />
                <CurrentQuantityRule />
            </ServiceBuilderProvider>,
        );
        await screen.findByText('Selection overview');
        fireEvent.click(screen.getByRole('button', { name: 'Add quantity default' }));
        fireEvent.change(screen.getByLabelText('Quantity default'), { target: { value: '25' } });
        await waitFor(() => expect(screen.getByLabelText('Current field quantity')).toHaveTextContent('25'));
        fireEvent.click(screen.getByRole('button', { name: 'Add quantity rule' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Eval' }));
        await waitFor(() => expect(screen.getByLabelText('Current field quantity rule')).toHaveTextContent('"value_by":"eval"'));
        fireEvent.change(await screen.findByLabelText('Eval code'), { target: { value: 'return Number(value) * 2;' } });
        expect(screen.getByLabelText('Current field quantity rule')).toHaveTextContent('return Number(value) * 2;');
        expect(screen.getByLabelText('Current field quantity rule')).not.toHaveTextContent('expressionBody');
    }, 15_000);

    it('edits descriptor-owned appearance overrides through the preserved appearance section', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalProperties />
                <CurrentDefaults />
            </ServiceBuilderProvider>,
        );
        await screen.findByText('Selection overview');
        const appearance = screen.getByRole('button', { name: 'Input appearance and behavior' });
        fireEvent.click(appearance);
        expect(screen.getByLabelText('Slot char')).toHaveValue('_');
        fireEvent.change(screen.getByLabelText('Slot char'), { target: { value: '#' } });
        await waitFor(() => expect(screen.getByLabelText('Current field defaults')).toHaveTextContent('"slotChar":"#"'));
    });

    it('binds the selected field to a canonical service through the preserved service section', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalProperties />
                <CurrentService />
            </ServiceBuilderProvider>,
        );
        await screen.findByText('Selection overview');
        fireEvent.change(screen.getByLabelText('Button mode'), { target: { value: 'true' } });
        const serviceSection = screen.getByRole('button', { name: 'Service' });
        fireEvent.click(serviceSection);
        await waitFor(() => expect(serviceSection).toHaveAttribute('aria-expanded', 'true'));
        fireEvent.change(await screen.findByLabelText('Service id'), { target: { value: '2946' } });
        await waitFor(() => expect(screen.getByLabelText('Current field service')).toHaveTextContent('2946'));
    }, 10_000);

    it('persists structured validation, trigger mappings, option effects, and value effects through the preserved advanced sections', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalProperties />
                <CurrentAdvancedProperties />
            </ServiceBuilderProvider>,
        );
        await screen.findByText('Selection overview');

        fireEvent.click(screen.getAllByRole('button', { name: 'Add validation' })[0]);
        await waitFor(() => expect(screen.getByLabelText('Current advanced properties')).toHaveTextContent('"op":"truthy"'));
        fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Required for delivery' } });
        await waitFor(() => expect(screen.getByLabelText('Current advanced properties')).toHaveTextContent('Required for delivery'));
        fireEvent.click(screen.getByRole('button', { name: 'Clear validation' }));
        await waitFor(() => expect(screen.getByLabelText('Current advanced properties')).toHaveTextContent('"validation":[]'));

        fireEvent.change(screen.getByLabelText('Button mode'), { target: { value: 'true' } });
        await screen.findByRole('button', { name: 'Includes' });
        const includesSection = screen.getByRole('button', { name: 'Includes' }).parentElement?.parentElement;
        expect(includesSection).toBeTruthy();
        fireEvent.click(within(includesSection!).getByRole('button', { name: 'Add' }));
        fireEvent.change(await screen.findByLabelText('input-field'), { target: { value: 'field:quantity' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(screen.getByLabelText('Current advanced properties')).toHaveTextContent('field:quantity'));

        const optionEffectsSection = screen.getByRole('button', { name: 'Option effects' }).parentElement?.parentElement;
        expect(optionEffectsSection).toBeTruthy();
        fireEvent.click(within(optionEffectsSection!).getByRole('button', { name: 'Add' }));
        fireEvent.change(await screen.findByLabelText('Force visible'), { target: { value: 'true' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(screen.getByLabelText('Current advanced properties')).toHaveTextContent('"field:url":{"force_visible":true}'));

        const valueEffectsSection = screen.getByRole('button', { name: 'Value effects' }).parentElement?.parentElement;
        expect(valueEffectsSection).toBeTruthy();
        fireEvent.click(within(valueEffectsSection!).getByRole('button', { name: 'Add' }));
        fireEvent.change(await screen.findByLabelText('Value'), { target: { value: 'preset' } });
        fireEvent.change(screen.getByLabelText('Assignment mode'), { target: { value: 'if_empty' } });
        fireEvent.change(screen.getByLabelText('Clear on deactivation'), { target: { value: 'true' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() =>
            expect(screen.getByLabelText('Current advanced properties')).toHaveTextContent(
                '"field:url":{"value":"preset","mode":"if_empty","clear_on_deactivate":true}',
            ),
        );
    }, 15_000);

    it('persists advisory utility settings through the canonical Editor', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <CanonicalProperties />
                <CurrentUtility />
            </ServiceBuilderProvider>,
        );
        await screen.findByText('Selection overview');
        fireEvent.click(screen.getByRole('button', { name: 'Add utility' }));
        fireEvent.change(await screen.findByLabelText('Rate'), { target: { value: '2.5' } });
        await waitFor(() => expect(screen.getByLabelText('Current utility')).toHaveTextContent('"rate":2.5'));
        expect(screen.getByLabelText('Current utility')).toHaveTextContent('"mode":"flat"');
        fireEvent.click(screen.getByRole('button', { name: 'Clear utility' }));
        await waitFor(() => expect(screen.getByLabelText('Current utility')).toHaveTextContent('null'));
    });

    it('persists filter capability requirements through the canonical Editor', async () => {
        render(
            <ServiceBuilderProvider backend={createIsolatedBackend()} actor={workspaceActor}>
                <SelectFilter />
                <CanonicalProperties />
                <CurrentCapabilities />
            </ServiceBuilderProvider>,
        );
        await screen.findByText('Selection overview');
        fireEvent.click(screen.getByRole('button', { name: 'Select platform filter' }));
        const constraints = await screen.findByRole('button', { name: 'Constraints' });
        const section = constraints.parentElement?.parentElement;
        expect(section).toBeTruthy();
        fireEvent.click(within(section!).getByRole('button', { name: 'Add' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
        await waitFor(() => expect(screen.getByLabelText('Current capabilities')).toHaveTextContent('"refill":true'));
        expect(screen.getByLabelText('Current capabilities')).toHaveTextContent('"cancel":false');
    }, 15_000);
});
