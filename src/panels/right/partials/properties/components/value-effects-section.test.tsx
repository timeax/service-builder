/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValueEffectsSection } from './value-effects-section.tsx';

const setValueEffect = vi.fn();
const clearValueEffect = vi.fn();

let canvasProps: any;

vi.mock('@/components/ui/button.tsx', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/popover.tsx', () => ({
    Popover: ({ children }: any) => <div>{children}</div>,
    PopoverTrigger: ({ children }: any) => <>{children}</>,
    PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/panels/right/components/sections.tsx', () => {
    const Section = ({ children }: { children: React.ReactNode }) => <section>{children}</section>;
    Section.Header = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    Section.Title = ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>;
    Section.Actions = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    Section.Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

    return {
        Section,
        IncludesList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        SectionActionButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        SectionActionTriggerButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    };
});

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        props: canvasProps,
        api: {
            editor: {
                setValueEffect,
                clearValueEffect,
            },
        },
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, options, onChange }: any) => {
        if (variant === 'select') {
            return (
                <label>
                    <span>{label}</span>
                    <select aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })}>
                        {(options ?? []).map((option: any) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        if (variant === 'toggle') {
            return (
                <label>
                    <span>{label}</span>
                    <input
                        aria-label={label}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => onChange?.({ value: event.target.checked })}
                    />
                </label>
            );
        }

        if (variant === 'checkbox') {
            const selected = new Set(Array.isArray(value) ? value : []);
            return (
                <fieldset aria-label={label}>
                    <legend>{label}</legend>
                    {(options ?? []).map((option: any) => (
                        <label key={option.value}>
                            <span>{option.label}</span>
                            <input
                                aria-label={`${label}: ${option.label}`}
                                type="checkbox"
                                checked={selected.has(option.value)}
                                onChange={(event) => {
                                    const next = new Set(selected);
                                    if (event.target.checked) next.add(option.value);
                                    else next.delete(option.value);
                                    onChange?.({ value: Array.from(next) });
                                }}
                            />
                        </label>
                    ))}
                </fieldset>
            );
        }

        return <input aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />;
    },
}));

function makeProps() {
    return {
        fields: [
            {
                id: 'f:trigger',
                label: 'Trigger',
                type: 'button',
                button: true,
            },
            {
                id: 'f:package',
                label: 'Package',
                type: 'select',
                options: [
                    { id: 'o:basic', label: 'Basic' },
                    { id: 'o:premium', label: 'Premium', children: [{ id: 'o:fast', label: 'Fast' }] },
                ],
            },
            {
                id: 'f:notes',
                label: 'Notes',
                type: 'text',
            },
            {
                id: 'f:inactive',
                label: 'Inactive',
                type: 'text',
                inactive: true,
            },
        ],
        value_effects_for_triggers: {
            'o:trigger': {
                'f:package': {
                    value: 'o:fast',
                    mode: 'if_empty',
                    clearOnDeactivate: true,
                },
            },
        },
    };
}

describe('ValueEffectsSection', () => {
    beforeEach(() => {
        canvasProps = makeProps();
        setValueEffect.mockReset();
        clearValueEffect.mockReset();
    });

    it('renders existing effects with option labels and mode details', () => {
        render(
            <ValueEffectsSection
                node={{ id: 'o:trigger', kind: 'option', field: () => ({ id: 'f:trigger' }) } as any}
                capability={{ canEdit: true }}
            />,
        );

        expect(screen.getByText('Value effects')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit Package value effect' })).toBeInTheDocument();
        expect(screen.getAllByText('Premium / Fast').length).toBeGreaterThan(0);
        expect(screen.getAllByText('If empty').length).toBeGreaterThan(0);
        expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('saves raw ids and filters parent/inactive fields from target choices', () => {
        canvasProps.value_effects_for_triggers = {};
        render(
            <ValueEffectsSection
                node={{ id: 'o:trigger', kind: 'option', field: () => ({ id: 'f:package' }) } as any}
                capability={{ canEdit: true }}
            />,
        );

        const targetField = screen.getByLabelText('Target field');
        expect(within(targetField).queryByRole('option', { name: 'Package' })).not.toBeInTheDocument();
        expect(within(targetField).queryByRole('option', { name: 'Inactive' })).not.toBeInTheDocument();
        expect(within(targetField).getByRole('option', { name: 'Trigger' })).toBeInTheDocument();

        fireEvent.change(targetField, { target: { value: 'f:notes' } });
        fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'hello' } });
        fireEvent.change(screen.getByLabelText('Assignment mode'), { target: { value: 'if_empty' } });
        fireEvent.click(screen.getByLabelText('Clear on deactivation'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(setValueEffect).toHaveBeenCalledWith('o:trigger', 'f:notes', {
            value: 'hello',
            mode: 'if_empty',
            clearOnDeactivate: true,
        });
    });

    it('removes an effect through the editor api', () => {
        render(
            <ValueEffectsSection
                node={{ id: 'o:trigger', kind: 'option', field: () => ({ id: 'f:trigger' }) } as any}
                capability={{ canEdit: true }}
            />,
        );

        fireEvent.click(screen.getByLabelText('Remove Package value effect'));

        expect(clearValueEffect).toHaveBeenCalledWith('o:trigger', 'f:package');
    });
});
