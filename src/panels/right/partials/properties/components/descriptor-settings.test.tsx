import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DescriptorSettings } from './descriptor-settings.tsx';
import {
    createDefaultDescriptorUiRendererRegistry,
    DescriptorUiRendererProvider,
    type DescriptorUiRendererProps,
} from './descriptor-ui-renderers.tsx';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, options, onChange, onBlur, placeholder, disabled, autoComplete, autoCap }: any) => {
        const ariaLabel = label ?? placeholder ?? 'input-field';

        if (variant === 'select') {
            return (
                <select
                    aria-label={ariaLabel}
                    data-auto-cap={autoCap ? 'true' : undefined}
                    value={value ?? ''}
                    disabled={disabled}
                    onBlur={onBlur}
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

        if (variant === 'toggle') {
            return (
                <label>
                    <span>{ariaLabel}</span>
                    <input
                        aria-label={ariaLabel}
                        type="checkbox"
                        checked={Boolean(value)}
                        disabled={disabled}
                        onBlur={onBlur}
                        onChange={(event) => onChange?.({ value: event.target.checked })}
                    />
                </label>
            );
        }

        if (variant === 'multi-select') {
            return (
                <div aria-label={ariaLabel} data-auto-cap={autoCap ? 'true' : undefined}>
                    {(options ?? []).map((option: any) => (
                        <button
                            key={String(option.value)}
                            type="button"
                            disabled={disabled}
                            onBlur={onBlur}
                            onClick={() => onChange?.({ value: [option.value] })}
                        >
                            {option.label}
                        </button>
                    ))}
                    <button type="button" disabled={disabled} onClick={() => onChange?.({ value: [] })}>
                        Clear {ariaLabel}
                    </button>
                    <span data-testid={`${ariaLabel}-value`}>{JSON.stringify(value ?? [])}</span>
                </div>
            );
        }

        return (
            <input
                aria-label={ariaLabel}
                data-variant={variant}
                value={value ?? ''}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                onBlur={onBlur}
                onChange={(event) => onChange?.({
                    value: variant === 'date' && event.target.value
                        ? new Date(`${event.target.value}T00:00:00.000Z`)
                        : event.target.value,
                })}
            />
        );
    },
}));

function Harness({
    schema,
    initialDefaults = {},
    children,
    onDefaults,
}: {
    schema: Record<string, any>;
    initialDefaults?: Record<string, unknown>;
    children?: (defaults: Record<string, unknown>) => ReactNode;
    onDefaults?: (defaults: Record<string, unknown>) => void;
}) {
    const [defaults, setDefaults] = useState<Record<string, unknown>>(initialDefaults);

    const handleChange = (next: Record<string, unknown> | undefined) => {
        const resolved = next ?? {};
        setDefaults(resolved);
        onDefaults?.(resolved);
    };

    return (
        <>
            <DescriptorSettings schema={schema as any} defaults={defaults} onChange={handleChange} />
            <pre data-testid="defaults">{JSON.stringify(defaults)}</pre>
            {children?.(defaults)}
        </>
    );
}

const readDefaults = () => JSON.parse(screen.getByTestId('defaults').textContent || '{}');

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
        expect(readDefaults()).toEqual({});
        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Limited offer' } });
        fireEvent.change(screen.getByLabelText('Text color'), { target: { value: '#ffffff' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(readDefaults()).toEqual({ tags: [{ label: 'Limited offer', color: '#ffffff' }] });
    });

    it('edits array items in a popup and keeps changes only after Save', () => {
        const initialTags = [{ label: 'Existing tag', color: '#111111' }];
        render(
            <Harness
                initialDefaults={{ tags: initialTags }}
                schema={{ tags: { type: 'array', label: 'Tags', item: { type: 'object', fields: { label: { type: 'string', label: 'Label' }, color: { type: 'string', label: 'Color' } } } } }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Canceled change' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(readDefaults()).toEqual({ tags: initialTags });

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Saved change' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(readDefaults()).toEqual({ tags: [{ label: 'Saved change', color: '#111111' }] });
    });

    it('derives a label for an unlabeled nested string property', () => {
        render(<Harness schema={{
            tags: {
                type: 'array',
                label: 'Tags',
                item: { type: 'object', fields: { label: { type: 'string' } } },
            },
        }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

        expect(screen.getByLabelText('Label')).toBeInTheDocument();
    });

    it('omits empty-string enum values from descriptor selects', () => {
        render(<Harness schema={{ mode: { type: 'string', enum: ['', 'compact', 'comfortable'] } }} />);

        const modeSelect = screen.getByLabelText('Mode');
        const options = Array.from(modeSelect.querySelectorAll('option')).map((option) => option.value);
        expect(options).toEqual(['compact', 'comfortable']);
        expect(modeSelect).toHaveAttribute('data-auto-cap', 'true');
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

    it('stores string text values and clears blank text values', () => {
        render(<Harness schema={{ title: { type: 'string', label: 'Title', description: 'Title text.' } }} />);

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Hello' } });
        expect(readDefaults()).toEqual({ title: 'Hello' });

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
        expect(readDefaults()).toEqual({});
    });

    it('stores string enum selections normally', () => {
        render(<Harness schema={{ size: { type: 'string', label: 'Size', description: 'Size choice.', enum: ['small', 'large'] } }} />);

        fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'large' } });

        expect(readDefaults()).toEqual({ size: 'large' });
    });

    it('stores finite numbers and clears invalid numbers', () => {
        render(<Harness schema={{ count: { type: 'number', label: 'Count', description: 'Count value.' } }} />);

        fireEvent.change(screen.getByLabelText('Count'), { target: { value: '12.5' } });
        expect(readDefaults()).toEqual({ count: 12.5 });

        fireEvent.change(screen.getByLabelText('Count'), { target: { value: 'nope' } });
        expect(readDefaults()).toEqual({});
    });

    it('uses a supported Form Palette variant while preserving the primitive value type', () => {
        render(<Harness schema={{ accent: { type: 'string', variant: 'color', label: 'Accent', description: 'Accent color.' } }} />);

        const input = screen.getByLabelText('Accent');
        expect(input).toHaveAttribute('data-variant', 'color');
        fireEvent.change(input, { target: { value: '#336699' } });

        expect(readDefaults()).toEqual({ accent: '#336699' });
    });

    it('serializes a single date variant back to a JSON-safe string', () => {
        render(<Harness schema={{ date: { type: 'string', variant: 'date', label: 'Date', description: 'Date value.' } }} />);

        const input = screen.getByLabelText('Date');
        expect(input).toHaveAttribute('data-variant', 'date');
        fireEvent.change(input, { target: { value: '2026-04-10' } });

        expect(readDefaults()).toEqual({ date: '2026-04-10T00:00:00.000Z' });
    });

    it('stores boolean toggle values', () => {
        render(<Harness schema={{ enabled: { type: 'boolean', label: 'Enabled', description: 'Enabled state.' } }} />);

        fireEvent.click(screen.getByLabelText('Enabled'));

        expect(readDefaults()).toEqual({ enabled: true });
    });

    it('stores single anyOf selections', () => {
        render(
            <Harness
                schema={{
                    mode: {
                        type: 'anyOf',
                        label: 'Mode',
                        description: 'Mode choice.',
                        items: [
                            { type: 'string', title: 'Fast', value: 'fast' },
                            { type: 'string', title: 'Slow', value: 'slow' },
                        ],
                    },
                }}
            />,
        );

        fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'slow' } });

        expect(readDefaults()).toEqual({ mode: 'slow' });
    });

    it('stores and clears multiple anyOf selections', () => {
        render(
            <Harness
                schema={{
                    channels: {
                        type: 'anyOf',
                        multiple: true,
                        label: 'Channels',
                        description: 'Channel choices.',
                        items: [
                            { type: 'string', title: 'Email', value: 'email' },
                            { type: 'string', title: 'SMS', value: 'sms' },
                        ],
                    },
                }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'SMS' }));
        expect(screen.getByLabelText('Channels')).toHaveAttribute('data-auto-cap', 'true');
        expect(readDefaults()).toEqual({ channels: ['sms'] });

        fireEvent.click(screen.getByRole('button', { name: 'Clear Channels' }));
        expect(readDefaults()).toEqual({});
    });

    it('resets overrides through the built-in field description reset control', () => {
        render(<Harness initialDefaults={{ title: 'Current' }} schema={{ title: { type: 'string', label: 'Title', description: 'Title text.' } }} />);

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

        expect(readDefaults()).toEqual({});
    });

    it('passes normalized props to custom renderers and writes through path callbacks', () => {
        const registry = createDefaultDescriptorUiRendererRegistry();
        let latestProps: DescriptorUiRendererProps | undefined;
        registry.register('host:test', (props) => {
            latestProps = props;
            return <div data-testid="custom-renderer">Custom renderer</div>;
        });

        render(
            <DescriptorUiRendererProvider registry={registry}>
                <Harness
                    initialDefaults={{ custom: 'initial' }}
                    schema={{
                        custom: {
                            type: 'host:test',
                            label: 'Custom',
                            description: 'Custom value.',
                            extra: true,
                        },
                    }}
                />
            </DescriptorUiRendererProvider>,
        );

        expect(screen.getByTestId('custom-renderer')).toBeInTheDocument();
        expect(latestProps?.schema).toMatchObject({ type: 'host:test', extra: true });
        expect(latestProps?.value).toBe('initial');
        expect(latestProps?.path).toEqual(['custom']);
        expect(latestProps?.name).toBe('custom');
        expect(latestProps?.hasOverride).toBe(true);
        expect(latestProps?.onChange).toEqual(expect.any(Function));
        expect(latestProps?.onClear).toEqual(expect.any(Function));
        expect(latestProps?.onBlur).toEqual(expect.any(Function));

        act(() => latestProps?.onChange('custom-value'));
        expect(readDefaults()).toEqual({ custom: 'custom-value' });

        act(() => latestProps?.onClear());
        expect(readDefaults()).toEqual({});
    });

    it('writes custom renderer values inside object fields and array items', () => {
        const registry = createDefaultDescriptorUiRendererRegistry();
        registry.register('host:test', ({ path, onChange }) => (
            <button type="button" onClick={() => onChange(`value:${path.join('.')}`)}>
                Set {path.join('.')}
            </button>
        ));

        render(
            <DescriptorUiRendererProvider registry={registry}>
                <Harness
                    schema={{
                        config: {
                            type: 'object',
                            label: 'Config',
                            description: 'Config object.',
                            fields: {
                                icon: { type: 'host:test', label: 'Icon', description: 'Icon value.' },
                            },
                        },
                        items: {
                            type: 'array',
                            label: 'Items',
                            description: 'Items array.',
                            editable: true,
                            item: { type: 'host:test', label: 'Item', description: 'Item value.' },
                        },
                    }}
                />
            </DescriptorUiRendererProvider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Set config.icon' }));
        expect(readDefaults()).toEqual({ config: { icon: 'value:config.icon' } });

        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
        fireEvent.click(screen.getByRole('button', { name: 'Set items.0' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(readDefaults()).toEqual({
            config: { icon: 'value:config.icon' },
            items: ['value:items.0'],
        });
    });

    it('renders a non-fatal message for unknown descriptor UI types', () => {
        render(<Harness schema={{ icon: { type: 'host:missing', label: 'Icon', description: 'Icon picker.' } }} />);

        expect(screen.getByText(/No descriptor settings renderer is registered for "host:missing"/)).toBeInTheDocument();
    });
});
