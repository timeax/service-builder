import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddService } from './add-service.tsx';

const filterServicesForVisibleGroup = vi.fn();
const setCatalogViewMode = vi.fn();
const setActiveCatalogNode = vi.fn();
const setService = vi.fn();

let selectedButtonsState: string[] = [];
let catalogState: any;
let listeners: Record<string, Array<(payload: any) => void>>;

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function emit(event: string, payload: any) {
    for (const listener of listeners[event] ?? []) listener(payload);
}

function ensureCatalogState() {
    if (catalogState) return clone(catalogState);
    catalogState = {
        version: 1,
        nodes: [],
        activeNodeId: undefined,
        expandedIds: [],
        pinnedNodeIds: [],
        selectedServiceId: undefined,
        viewMode: 'all',
    };
    return clone(catalogState);
}

const canvasMock = {
    props: {
        filters: [{ id: 't:root', label: 'Root', constraints: {}, service_id: 101 }],
        fields: [{ id: 'f:route', label: 'Route', options: [{ id: 'o:fast', label: 'Fast' }] }],
    },
    layers: { tags: [{ id: 't:root' }] },
    selectionInfo: { ids: [], optionIds: [] },
    api: {
        selection: {
            currentTag: () => 't:root',
            selectedButtons: () => selectedButtonsState,
        },
        editor: {
            setService,
            filterServicesForVisibleGroup,
            getCatalog: () => clone(catalogState),
            ensureCatalog: () => ensureCatalogState(),
            setCatalogViewMode: (mode: string) => {
                setCatalogViewMode(mode);
                ensureCatalogState();
                catalogState.viewMode = mode;
                emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:set-view-mode' });
            },
            setActiveCatalogNode: (groupId?: string) => {
                setActiveCatalogNode(groupId);
                ensureCatalogState();
                catalogState.activeNodeId = groupId;
                emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:set-active' });
                emit('catalog:active-change', { activeNodeId: groupId });
            },
        },
        on: (event: string, handler: (payload: any) => void) => {
            listeners[event] ??= [];
            listeners[event].push(handler);
            return () => {
                listeners[event] = (listeners[event] ?? []).filter((entry) => entry !== handler);
            };
        },
    },
};

const workspace = {
    services: {
        data: {
            101: { id: 101, name: 'Alpha Service', category: 'Payments', rate: 10, meta: { raw: { key: 'alpha' } } },
            202: { id: 202, name: 'Beta Service', category: 'Routing', rate: 20 },
            303: { id: 303, name: 'Gamma Service', category: 'Risk', rate: 30 },
        },
    },
    policies: { policies: { data: [] } },
};

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => canvasMock,
    useWorkspace: () => workspace,
}));

vi.mock('@/components/ui/scroll-area.tsx', () => ({
    ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, onChange, options, placeholder, trailingControl, disabled }: any) => {
        const ariaLabel = label ?? placeholder ?? 'input-field';
        if (variant === 'radio') {
            return (
                <div>
                    {(options ?? []).map((option: any) => {
                        const optionValue = String(option.key ?? option.value);
                        return (
                            <label key={optionValue}>
                                <input
                                    aria-label={option.label}
                                    type="radio"
                                    name="radio-group"
                                    checked={String(value ?? '') === optionValue}
                                    onChange={() => onChange?.({ value: optionValue })}
                                />
                                {option.label}
                            </label>
                        );
                    })}
                </div>
            );
        }
        if (variant === 'treeselect') {
            const flattenedOptions = flattenTreeOptions(options ?? []);
            return (
                <div>
                    <select
                        aria-label={ariaLabel}
                        value={value ?? ''}
                        disabled={disabled}
                        onChange={(event) => onChange?.({ value: event.target.value || undefined })}
                    >
                        <option value="">Select</option>
                        {flattenedOptions.map((option: any) => (
                            <option key={String(option.key)} value={option.key}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            );
        }

        return (
            <div>
                <input
                    aria-label={ariaLabel}
                    type="text"
                    value={value ?? ''}
                    placeholder={placeholder}
                    onChange={(event) => onChange?.({ value: event.target.value })}
                />
                {trailingControl}
            </div>
        );
    },
}));

function flattenTreeOptions(options: Array<any>): Array<any> {
    return options.flatMap((option) => [option, ...flattenTreeOptions(option.children ?? [])]);
}

function openAddServicePopover() {
    render(<AddService data={{ id: 'f:route', kind: 'field', raw: { service_id: undefined } } as any} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('AddService catalog/context filter', () => {
    beforeEach(() => {
        selectedButtonsState = ['o:fast'];
        listeners = {};
        setService.mockReset();
        filterServicesForVisibleGroup.mockReset();
        setCatalogViewMode.mockReset();
        setActiveCatalogNode.mockReset();
        filterServicesForVisibleGroup.mockReturnValue([
            { id: 101, fitsConstraints: true, passesRate: true, passesPolicies: true },
            { id: 202, fitsConstraints: false, passesRate: true, passesPolicies: true },
            { id: 303, fitsConstraints: true, passesRate: true, passesPolicies: true },
        ]);
        catalogState = {
            version: 1,
            nodes: [{ id: 'cg:1', kind: 'group', label: 'Payments', serviceIds: [101, 202] }],
            activeNodeId: undefined,
            expandedIds: [],
            pinnedNodeIds: [],
            selectedServiceId: undefined,
            viewMode: 'all',
        };
    });

    it('renders trailing filter control and opens filter popover', async () => {
        openAddServicePopover();

        fireEvent.click(screen.getByRole('button', { name: 'Service list filter' }));
        await screen.findByText('Service filters');
        expect(screen.getByLabelText('Current context')).toBeInTheDocument();
    });

    it('routes catalog scope and group selection through editor APIs', async () => {
        openAddServicePopover();
        fireEvent.click(screen.getByRole('button', { name: 'Service list filter' }));
        await screen.findByText('Service filters');

        fireEvent.click(screen.getByLabelText('Catalog group'));
        expect(setCatalogViewMode).toHaveBeenCalledWith('grouped');

        fireEvent.change(screen.getByLabelText('Select group'), { target: { value: 'cg:1' } });
        expect(setActiveCatalogNode).toHaveBeenCalledWith('cg:1');
    });

    it('applies catalog group and current context filters together', async () => {
        openAddServicePopover();
        expect(screen.getByText('Alpha Service')).toBeInTheDocument();
        expect(screen.getByText('Beta Service')).toBeInTheDocument();
        expect(screen.getByText('Gamma Service')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Service list filter' }));
        await screen.findByText('Service filters');

        fireEvent.click(screen.getByLabelText('Catalog group'));
        fireEvent.change(screen.getByLabelText('Select group'), { target: { value: 'cg:1' } });

        await waitFor(() => {
            expect(screen.getByText('Alpha Service')).toBeInTheDocument();
            expect(screen.getByText('Beta Service')).toBeInTheDocument();
            expect(screen.queryByText('Gamma Service')).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText('Current context'));

        await waitFor(() => {
            expect(filterServicesForVisibleGroup).toHaveBeenCalledWith(
                [101, 202, 303],
                expect.objectContaining({ tagId: 't:root', selectedButtons: ['o:fast'] }),
            );
            expect(screen.getByText('Alpha Service')).toBeInTheDocument();
            expect(screen.queryByText('Beta Service')).not.toBeInTheDocument();
            expect(screen.queryByText('Gamma Service')).not.toBeInTheDocument();
        });
    });

    it('shows meta info popover in selected service summary', async () => {
        render(<AddService data={{ id: 'f:route', kind: 'field', raw: { service_id: 101 } } as any} />);

        fireEvent.click(screen.getByRole('button', { name: 'More service info' }));
        expect(await screen.findByText('More info')).toBeInTheDocument();
        expect(screen.getByText('raw.key')).toBeInTheDocument();
        expect(screen.getByText('alpha')).toBeInTheDocument();
    });

    it('applies manual primary rate filtering without enabling current context', async () => {
        filterServicesForVisibleGroup.mockImplementation((_candidateIds, args) => {
            if (args.rateContext?.mode === 'custom_primary_rate' && args.rateContext?.source === 'manual' && args.rateContext?.primaryRate === 12) {
                return [
                    { id: 101, fitsConstraints: true, passesRate: true, passesPolicies: true },
                    { id: 202, fitsConstraints: true, passesRate: false, passesPolicies: true },
                    { id: 303, fitsConstraints: true, passesRate: true, passesPolicies: true },
                ];
            }

            return [
                { id: 101, fitsConstraints: true, passesRate: true, passesPolicies: true },
                { id: 202, fitsConstraints: true, passesRate: true, passesPolicies: true },
                { id: 303, fitsConstraints: true, passesRate: true, passesPolicies: true },
            ];
        });
        openAddServicePopover();
        fireEvent.click(screen.getByRole('button', { name: 'Service list filter' }));
        await screen.findByText('Service filters');

        fireEvent.click(screen.getByLabelText('Custom primary rate'));
        fireEvent.click(screen.getByLabelText('Manual rate'));
        fireEvent.change(screen.getByLabelText('Primary rate'), { target: { value: '12' } });

        await waitFor(() => {
            expect(filterServicesForVisibleGroup).toHaveBeenLastCalledWith(
                [101, 202, 303],
                expect.objectContaining({
                    rateContext: expect.objectContaining({
                        mode: 'custom_primary_rate',
                        source: 'manual',
                        primaryRate: 12,
                    }),
                }),
            );
        });
        await waitFor(() => {
            expect(screen.getByText('Alpha Service')).toBeInTheDocument();
            expect(screen.queryByText('Beta Service')).not.toBeInTheDocument();
            expect(screen.getByText('Gamma Service')).toBeInTheDocument();
        });
    });

    it('does not apply custom primary filtering until a manual rate is valid', async () => {
        openAddServicePopover();
        fireEvent.click(screen.getByRole('button', { name: 'Service list filter' }));
        await screen.findByText('Service filters');

        fireEvent.click(screen.getByLabelText('Custom primary rate'));
        fireEvent.click(screen.getByLabelText('Manual rate'));

        await screen.findByText('Provide a primary service or valid primary rate to apply compatibility filtering.');
        expect(screen.getByText('Alpha Service')).toBeInTheDocument();
        expect(screen.getByText('Beta Service')).toBeInTheDocument();
        expect(screen.getByText('Gamma Service')).toBeInTheDocument();
    });
});
