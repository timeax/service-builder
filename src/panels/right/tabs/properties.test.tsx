import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Properties } from './properties.tsx';

const { editLabel, mockUseCanvas, mockUseWorkspace } = vi.hoisted(() => ({
    editLabel: vi.fn(),
    mockUseCanvas: vi.fn(),
    mockUseWorkspace: vi.fn(),
}));

vi.mock('@/builder/view-models.tsx', () => ({
    describeBinding: () => 'Tag: Root',
    getNodeSummary: () => 'Route field',
}));

vi.mock('@/components/builder/index.tsx', () => ({
    EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
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
    SelectionBadge: () => <div data-testid="selection-badge" />,
}));

vi.mock('@/components/ui/scroll-area.tsx', () => ({
    ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock('@/panels/right/components/text.tsx', () => ({
    FieldLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/panels/right/partials/properties/field-properties.tsx', () => ({
    __esModule: true,
    default: () => <div>FieldProperties</div>,
}));

vi.mock('@/panels/right/partials/properties/option-properties.tsx', () => ({
    __esModule: true,
    default: () => <div>OptionProperties</div>,
}));

vi.mock('@/panels/right/partials/properties/tag.tsx', () => ({
    TagProperties: () => <div>TagProperties</div>,
}));

vi.mock('@/workspace/boot-status.tsx', () => ({
    WorkspaceBootInlineNotice: () => null,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => mockUseCanvas(),
    useWorkspace: () => mockUseWorkspace(),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, onChange, onBlur, onFocus, onKeyDown, disabled }: any) => {
        const ariaLabel = typeof label === 'string' ? label : label?.props?.children ?? 'input-field';

        return (
            <input
                aria-label={ariaLabel}
                disabled={disabled}
                value={value ?? ''}
                onBlur={onBlur}
                onChange={(event) => onChange?.({ value: event.target.value })}
                onFocus={onFocus}
                onKeyDown={onKeyDown}
            />
        );
    },
}));

function createNode(label = 'Route') {
    return {
        id: 'f:route',
        kind: 'field',
        raw: {
            label,
            type: 'text',
        },
    };
}

function renderProperties(label = 'Route') {
    const node = createNode(label);
    mockUseCanvas.mockReturnValue({
        activeId: node.id,
        props: {},
        selection: {},
        selectionInfo: { ids: [node.id] },
        selector: {
            getNode: () => node,
        },
        api: {
            editor: {
                editLabel,
            },
        },
    });

    render(<Properties />);
}

describe('Properties label input', () => {
    beforeEach(() => {
        editLabel.mockReset();
        mockUseCanvas.mockReset();
        mockUseWorkspace.mockReturnValue({
            boot: { isReady: true },
        });
    });

    it('keeps empty label drafts local and restores the loaded label on blur or Enter', () => {
        renderProperties();

        const labelInput = screen.getByLabelText('Label') as HTMLInputElement;
        expect(labelInput.value).toBe('Route');

        fireEvent.change(labelInput, { target: { value: 'Renamed Route' } });
        expect(labelInput.value).toBe('Renamed Route');
        expect(editLabel).toHaveBeenLastCalledWith('f:route', 'Renamed Route');

        editLabel.mockClear();
        fireEvent.change(labelInput, { target: { value: '' } });
        expect(labelInput.value).toBe('');
        expect(editLabel).not.toHaveBeenCalled();

        fireEvent.blur(labelInput);
        expect(labelInput.value).toBe('Route');

        fireEvent.focus(labelInput);
        fireEvent.change(labelInput, { target: { value: '   ' } });
        expect(labelInput.value).toBe('   ');
        expect(editLabel).not.toHaveBeenCalled();

        fireEvent.keyDown(labelInput, { key: 'Enter' });
        expect(labelInput.value).toBe('Route');
    });
});
