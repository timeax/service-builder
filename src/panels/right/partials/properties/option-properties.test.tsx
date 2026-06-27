import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptionProperties } from './option-properties.tsx';

const updateField = vi.fn();

vi.mock('@/builder/view-models.tsx', () => ({
    describeBinding: () => 'Package',
}));

vi.mock('@/components/builder/index.tsx', () => ({
    PropertyList: ({ items }: { items: Array<{ label: string; value: string }> }) => (
        <div>
            {items.map((item) => (
                <div key={item.label}>
                    {item.label}: {item.value}
                </div>
            ))}
        </div>
    ),
}));

vi.mock('@/components/ui/separator.tsx', () => ({
    Separator: () => <div />,
}));

vi.mock('@/panels/right/components/sections.tsx', () => {
    const Section = ({ children }: { children: React.ReactNode }) => <section>{children}</section>;
    Section.Header = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    Section.Title = ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>;
    Section.Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    return { Section };
});

vi.mock('@/panels/right/partials/global/add-service.tsx', () => ({
    AddService: () => <div />,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        api: {
            editor: {
                updateField,
            },
        },
    }),
}));

vi.mock('./components/node-capabilities.ts', () => ({
    getOptionPropertyCapabilities: () => ({
        triggerMappings: { canEdit: false, message: 'N/A' },
        service: { canEdit: true, message: null },
    }),
}));

vi.mock('./components/order-kind-section.tsx', () => ({
    default: () => <div />,
}));

vi.mock('./components/quantity-section.tsx', () => ({
    default: () => <div />,
}));

vi.mock('./components/option-effects-section.tsx', () => ({
    default: () => <div />,
}));

vi.mock('./components/utility-section.tsx', () => ({
    default: () => <div />,
}));

vi.mock('./components/Union', () => ({
    IncExcludeSection: () => <div />,
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, onChange }: any) => (
        <input aria-label={label} value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />
    ),
}));

function createNestedOptionNode() {
    const field = {
        id: 'f:package',
        raw: {
            label: 'Package',
            options: [
                {
                    id: 'o:premium',
                    label: 'Premium',
                    children: [
                        { id: 'o:fast', label: 'Fast', value: 'fast' },
                        { id: 'o:safe', label: 'Safe', value: 'safe' },
                    ],
                },
            ],
        },
    };

    return {
        id: 'o:fast',
        kind: 'option',
        raw: { id: 'o:fast', label: 'Fast', value: 'fast' },
        field: () => field,
    } as any;
}

describe('OptionProperties nested editing', () => {
    it('updates a nested option label by raw option id', () => {
        updateField.mockReset();
        render(<OptionProperties node={createNestedOptionNode()} />);

        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Express' } });

        expect(updateField).toHaveBeenCalledWith('f:package', {
            options: [
                {
                    id: 'o:premium',
                    label: 'Premium',
                    children: [
                        { id: 'o:fast', label: 'Express', value: 'fast' },
                        { id: 'o:safe', label: 'Safe', value: 'safe' },
                    ],
                },
            ],
        });
    });
});
