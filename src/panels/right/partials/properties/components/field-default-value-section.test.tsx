/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldDefaultValueSection } from './field-default-value-section.tsx';

const setFieldDefaultValue = vi.fn();
const clearFieldDefaultValue = vi.fn();

vi.mock('@/components/ui/button.tsx', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/panels/right/components/sections.tsx', () => {
    const Section = ({ children }: { children: React.ReactNode }) => <section>{children}</section>;
    Section.Header = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    Section.Title = ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>;
    Section.Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    return { Section };
});

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        api: {
            editor: {
                setFieldDefaultValue,
                clearFieldDefaultValue,
            },
        },
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, options, onChange, onBlur }: any) => {
        if (variant === 'select') {
            return (
                <select aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })}>
                    {(options ?? []).map((option: any) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
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

        return <input aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} onBlur={onBlur} />;
    },
}));

describe('FieldDefaultValueSection', () => {
    beforeEach(() => {
        setFieldDefaultValue.mockReset();
        clearFieldDefaultValue.mockReset();
    });

    it('saves selectable default option ids through the editor api', () => {
        render(
            <FieldDefaultValueSection
                node={
                    {
                        id: 'f:quality',
                        raw: {
                            id: 'f:quality',
                            label: 'Quality',
                            type: 'select',
                            options: [
                                { id: 'o:basic', label: 'Basic' },
                                { id: 'o:premium', label: 'Premium', children: [{ id: 'o:fast', label: 'Fast' }] },
                            ],
                            meta: { multi: true },
                        },
                    } as any
                }
            />,
        );

        fireEvent.click(screen.getByLabelText('Default value: Premium / Fast'));

        expect(setFieldDefaultValue).toHaveBeenCalledWith('f:quality', ['o:fast']);
    });

    it('parses primitive draft defaults and clears empty values', () => {
        render(
            <FieldDefaultValueSection
                node={
                    {
                        id: 'f:quantity',
                        raw: {
                            id: 'f:quantity',
                            label: 'Quantity',
                            type: 'number',
                            defaultValue: 7,
                        },
                    } as any
                }
            />,
        );

        const input = screen.getByLabelText('Default value');
        fireEvent.change(input, { target: { value: '9' } });
        fireEvent.blur(input);
        expect(setFieldDefaultValue).toHaveBeenCalledWith('f:quantity', 9);

        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(clearFieldDefaultValue).toHaveBeenCalledWith('f:quantity');
    });
});
