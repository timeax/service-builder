import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldProperties } from './field-properties.tsx';

const updateField = vi.fn();
const editName = vi.fn();

vi.mock('@/builder/view-models.tsx', () => ({
    describeBinding: () => 'Tag: Root',
}));

vi.mock('@/components/builder/index.tsx', () => ({
    PropertyList: ({ items }: { items: Array<{ label: string; value: string }> }) => (
        <div>
            {items.map((item) => (
                <div key={item.label}>
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                </div>
            ))}
        </div>
    ),
}));

vi.mock('@/components/ui/separator.tsx', () => ({
    Separator: () => <div data-testid="separator" />,
}));

vi.mock('@/panels/right/components/sections.tsx', () => {
    const Section = ({ children }: { children: React.ReactNode }) => <section>{children}</section>;
    Section.Header = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    Section.Title = ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>;
    Section.Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    return { Section };
});

vi.mock('@/panels/right/partials/global/add-service.tsx', () => ({
    AddService: () => <div>AddService</div>,
}));

vi.mock('@timeax/digital-service-engine/react', () => ({
    useInputs: () => ({
        registry: { _store: new Map([['text', new Map()]]) },
    }),
    resolveInputDescriptor: () => null,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        props: {},
        api: {
            editor: {
                updateField,
                editName,
            },
            builder: {
                getProps: () => ({ fields: [] }),
            },
        },
    }),
}));

vi.mock('./components/descriptor-settings.tsx', () => ({
    DescriptorSettings: () => <div>DescriptorSettings</div>,
    getDescriptorUiKeys: () => [],
}));

vi.mock('./components/node-capabilities.ts', () => ({
    getFieldPropertyCapabilities: () => ({
        buttonModeLocked: false,
        isButton: false,
        buttonModeMessage: null,
        triggerMappings: { canEdit: false, message: 'N/A' },
        service: { canEdit: true, message: null },
    }),
}));

vi.mock('./components/quantity-section.tsx', () => ({
    default: () => <div>QuantitySection</div>,
}));

vi.mock('./components/utility-section.tsx', () => ({
    default: () => <div>UtilitySection</div>,
}));

vi.mock('./components/validation-section.tsx', () => ({
    default: () => <div>ValidationSection</div>,
}));

vi.mock('./components/Union', () => ({
    IncExcludeSection: () => <div>IncExcludeSection</div>,
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, options, onChange, disabled }: any) => {
        const ariaLabel = label ?? 'input-field';
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
        if (variant === 'toggle') {
            return (
                <label>
                    <span>{ariaLabel}</span>
                    <input
                        aria-label={ariaLabel}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => onChange?.({ value: event.target.checked })}
                    />
                </label>
            );
        }
        return (
            <input
                aria-label={ariaLabel}
                value={value ?? ''}
                onChange={(event) => onChange?.({ value: event.target.value })}
                onBlur={() => {}}
            />
        );
    },
}));

function createNode({ options = [], meta = {} as Record<string, unknown> }: { options?: any[]; meta?: Record<string, unknown> }) {
    return {
        id: 'f:route',
        kind: 'field',
        raw: {
            label: 'Route',
            type: 'text',
            name: 'route',
            required: false,
            button: false,
            defaults: {},
            options,
            meta,
        },
    } as any;
}

describe('FieldProperties multiple toggle', () => {
    it('shows Is multiple toggle only when field has options', () => {
        const withOptionsNode = createNode({ options: [{ id: 'o:1', label: 'One' }] });
        const { rerender } = render(<FieldProperties node={withOptionsNode} />);
        expect(screen.getByLabelText('Is multiple')).toBeInTheDocument();

        const withoutOptionsNode = createNode({ options: [] });
        rerender(<FieldProperties node={withoutOptionsNode} />);
        expect(screen.queryByLabelText('Is multiple')).not.toBeInTheDocument();
    });

    it('sets multi=true and preserves existing meta keys', () => {
        updateField.mockReset();
        const node = createNode({
            options: [{ id: 'o:1', label: 'One' }],
            meta: { variant: 'outlined', multi: false },
        });
        render(<FieldProperties node={node} />);

        fireEvent.click(screen.getByLabelText('Is multiple'));

        expect(updateField).toHaveBeenCalledWith(
            'f:route',
            expect.objectContaining({
                meta: expect.objectContaining({
                    variant: 'outlined',
                    multi: true,
                }),
            }),
        );
    });

    it('sets multi=false when toggled off', () => {
        updateField.mockReset();
        const node = createNode({
            options: [{ id: 'o:1', label: 'One' }],
            meta: { multi: true },
        });
        render(<FieldProperties node={node} />);

        fireEvent.click(screen.getByLabelText('Is multiple'));

        expect(updateField).toHaveBeenCalledWith(
            'f:route',
            expect.objectContaining({
                meta: expect.objectContaining({
                    multi: false,
                }),
            }),
        );
    });
});

