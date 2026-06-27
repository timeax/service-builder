import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OptionEffectsSection } from './option-effects-section.tsx';

const setOptionEffect = vi.fn();
const clearOptionEffect = vi.fn();

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
                setOptionEffect,
                clearOptionEffect,
            },
        },
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, options, onChange, disabled }: any) => {
        if (variant === 'select') {
            return (
                <label>
                    <span>{label}</span>
                    <select
                        aria-label={label}
                        value={value ?? ''}
                        disabled={disabled}
                        onChange={(event) => onChange?.({ value: event.target.value })}
                    >
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
                        disabled={disabled}
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
                                disabled={disabled}
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

        return <input aria-label={label} value={value ?? ''} disabled={disabled} onChange={(event) => onChange?.({ value: event.target.value })} />;
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
                type: 'treeselect',
                options: [
                    {
                        id: 'o:premium',
                        label: 'Premium',
                        children: [{ id: 'o:fast', label: 'Fast' }],
                    },
                    { id: 'o:basic', label: 'Basic' },
                ],
            },
            {
                id: 'f:notes',
                label: 'Notes',
                type: 'text',
            },
        ],
        option_effects_for_buttons: {
            'o:trigger': {
                'f:package': {
                    forceVisible: true,
                    include: ['o:fast'],
                    exclude: ['o:basic'],
                },
            },
        },
    };
}

describe('OptionEffectsSection', () => {
    beforeEach(() => {
        canvasProps = makeProps();
        setOptionEffect.mockReset();
        clearOptionEffect.mockReset();
    });

    it('renders existing effects with nested breadcrumb labels for option triggers', () => {
        render(
            <OptionEffectsSection
                node={{ id: 'o:trigger', kind: 'option', field: () => ({ id: 'f:trigger' }) } as any}
                capability={{ canEdit: true }}
            />,
        );

        expect(screen.getByText('Option effects')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit Package option effect' })).toBeInTheDocument();
        expect(screen.getAllByText('Premium / Fast').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Basic').length).toBeGreaterThan(0);
    });

    it('saves raw field and nested option ids through the editor api', () => {
        canvasProps.option_effects_for_buttons = {};
        render(<OptionEffectsSection node={{ id: 'f:trigger', kind: 'field' } as any} capability={{ canEdit: true }} />);

        fireEvent.change(screen.getByLabelText('Target field'), { target: { value: 'f:package' } });
        fireEvent.click(screen.getByLabelText('Force visible'));
        fireEvent.click(screen.getByLabelText('Include options: Premium / Fast'));
        fireEvent.click(screen.getByLabelText('Exclude options: Basic'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(setOptionEffect).toHaveBeenCalledWith('f:trigger', 'f:package', {
            forceVisible: true,
            include: ['o:fast'],
            exclude: ['o:basic'],
        });
    });

    it('filters an option trigger parent field out of target choices', () => {
        render(
            <OptionEffectsSection
                node={
                    {
                        id: 'o:trigger',
                        kind: 'option',
                        field: () => ({ id: 'f:package' }),
                    } as any
                }
                capability={{ canEdit: true }}
            />,
        );

        const targetField = screen.getByLabelText('Target field');
        expect(within(targetField).queryByRole('option', { name: 'Package' })).not.toBeInTheDocument();
        expect(within(targetField).getByRole('option', { name: 'Trigger' })).toBeInTheDocument();
        expect(screen.queryByText('Premium / Fast')).not.toBeInTheDocument();
    });

    it('removes an effect through the editor api', () => {
        render(
            <OptionEffectsSection
                node={{ id: 'o:trigger', kind: 'option', field: () => ({ id: 'f:trigger' }) } as any}
                capability={{ canEdit: true }}
            />,
        );

        fireEvent.click(screen.getByLabelText('Remove Package option effect'));

        expect(clearOptionEffect).toHaveBeenCalledWith('o:trigger', 'f:package');
    });

    it('allows force-visible-only effects for fields without options', () => {
        canvasProps.option_effects_for_buttons = {};
        render(<OptionEffectsSection node={{ id: 'f:trigger', kind: 'field' } as any} capability={{ canEdit: true }} />);

        fireEvent.change(screen.getByLabelText('Target field'), { target: { value: 'f:notes' } });
        fireEvent.click(screen.getByLabelText('Force visible'));

        expect(screen.queryByLabelText('Include options')).not.toBeInTheDocument();
        expect(screen.getByText('This target field has no options. Only force-visible behavior can be saved.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(setOptionEffect).toHaveBeenCalledWith('f:trigger', 'f:notes', {
            forceVisible: true,
        });
    });

    it('does not render when trigger mappings are unsupported', () => {
        const { container } = render(<OptionEffectsSection node={{ id: 'f:trigger', kind: 'field' } as any} capability={{ canEdit: false }} />);

        expect(within(container).queryByText('Option effects')).not.toBeInTheDocument();
    });
});
