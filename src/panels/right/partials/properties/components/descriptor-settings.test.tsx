import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DescriptorSettings } from './descriptor-settings.tsx';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, options, onChange, placeholder, disabled, autoComplete }: any) => {
        const ariaLabel = label ?? placeholder ?? 'input-field';
        if (variant === 'select') {
            return (
                <select
                    aria-label={ariaLabel}
                    value={value ?? ''}
                    disabled={disabled}
                    onChange={(event) => onChange?.({ value: event.target.value })}
                >
                    {(options ?? []).map((option: any) => (
                        <option key={String(option.value)} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }

        return (
            <input
                aria-label={ariaLabel}
                value={value ?? ''}
                placeholder={placeholder}
                autoComplete={autoComplete}
                onChange={(event) => onChange?.({ value: event.target.value })}
            />
        );
    },
}));

function Harness({ schema }: { schema: Record<string, any> }) {
    const [defaults, setDefaults] = useState<Record<string, unknown>>({});
    return <DescriptorSettings schema={schema as any} defaults={defaults} onChange={(next) => setDefaults(next ?? {})} />;
}

describe('DescriptorSettings', () => {
    it('renders label/color/bgColor for array object item after add', () => {
        const schema = {
            tags: {
                type: 'array',
                label: 'Tags',
                description: 'Tags list',
                editable: true,
                item: {
                    type: 'object',
                    label: 'Tag',
                    editable: true,
                    fields: {
                        label: { type: 'string', label: 'Label', description: 'Tag text.' },
                        color: { type: 'string', label: 'Text color', description: 'Text color.' },
                        bgColor: { type: 'string', label: 'Background color', description: 'Background color.' },
                    },
                    order: ['label', 'color', 'bgColor'],
                },
            },
        };

        render(<Harness schema={schema} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

        expect(screen.getByLabelText('Label')).toBeInTheDocument();
        expect(screen.getByLabelText('Text color')).toBeInTheDocument();
        expect(screen.getByLabelText('Background color')).toBeInTheDocument();
    });

    it('keeps internal event-like keys hidden while allowing normal label field keys', () => {
        const schema = {
            config: {
                type: 'object',
                label: 'Config',
                fields: {
                    label: { type: 'string', label: 'Label' },
                    onSubmit: { type: 'string', label: 'On submit' },
                },
                order: ['label', 'onSubmit'],
            },
        };

        render(<Harness schema={schema} />);
        expect(screen.getByLabelText('Label')).toBeInTheDocument();
        expect(screen.queryByLabelText('On submit')).not.toBeInTheDocument();
    });
});
