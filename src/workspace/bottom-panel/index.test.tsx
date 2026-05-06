import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomConsolePanel } from './index.tsx';

const filterServicesForVisibleGroup = vi.fn();
const createCatalogGroup = vi.fn();
const updateCatalogNode = vi.fn();
const removeCatalogNode = vi.fn();
const assignServicesToCatalogGroup = vi.fn();
const setCatalogViewMode = vi.fn();
const setSelectedCatalogService = vi.fn();
const setActiveCatalogNode = vi.fn();
const setCatalogExpanded = vi.fn();
const patchProps = vi.fn();
const replaceProps = vi.fn();
const transact = vi.fn();

let selectedButtonsState: string[] = [];
let catalogState: any;
let listeners: Record<string, Array<(payload: any) => void>>;
let canvasMock: ReturnType<typeof makeCanvas>;

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

function makeCanvas() {
    return {
        props: {
            filters: [{ id: 't:root', label: 'Root', service_id: 101 }],
            fields: [
                {
                    id: 'f:route',
                    label: 'Route',
                    options: [{ id: 'o:fast', label: 'Fast' }],
                },
            ],
        },
        layers: { tags: [{ id: 't:root' }] },
        activeId: null,
        selectionInfo: { ids: [], optionIds: [] },
        api: {
            selection: {
                currentTag: () => 't:root',
                selectedButtons: () => selectedButtonsState,
            },
            editor: {
                filterServicesForVisibleGroup,
                getCatalog: () => clone(catalogState),
                ensureCatalog: () => ensureCatalogState(),
                createCatalogGroup: (...args: any[]) => {
                    createCatalogGroup(...args);
                    const input = args[0];
                    ensureCatalogState();
                    const id = `cg:${catalogState.nodes.length + 1}`;
                    catalogState.nodes.push({ id, kind: 'group', label: input.label, parentId: input.parentId, serviceIds: [] });
                    catalogState.activeNodeId = id;
                    emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:create-group' });
                    emit('catalog:active-change', { activeNodeId: id });
                    return id;
                },
                updateCatalogNode: (...args: any[]) => {
                    updateCatalogNode(...args);
                },
                removeCatalogNode: (...args: any[]) => {
                    removeCatalogNode(...args);
                },
                assignServicesToCatalogGroup: (...args: any[]) => {
                    assignServicesToCatalogGroup(...args);
                },
                setCatalogViewMode: (mode: string) => {
                    setCatalogViewMode(mode);
                    ensureCatalogState();
                    catalogState.viewMode = mode;
                    emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:set-view-mode' });
                },
                setSelectedCatalogService: (serviceId?: string) => {
                    setSelectedCatalogService(serviceId);
                    ensureCatalogState();
                    catalogState.selectedServiceId = serviceId;
                    emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:set-selected-service' });
                },
                setActiveCatalogNode: (groupId?: string) => {
                    setActiveCatalogNode(groupId);
                    ensureCatalogState();
                    catalogState.activeNodeId = groupId;
                    emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:set-active' });
                    emit('catalog:active-change', { activeNodeId: groupId });
                },
                setCatalogExpanded: (groupId: string, expanded: boolean) => {
                    setCatalogExpanded(groupId, expanded);
                    ensureCatalogState();
                    const next = new Set(catalogState.expandedIds ?? []);
                    if (expanded) next.add(groupId);
                    else next.delete(groupId);
                    catalogState.expandedIds = Array.from(next);
                    emit('catalog:change', { catalog: clone(catalogState), reason: 'catalog:set-expanded' });
                },
                patchProps,
                replaceProps,
                transact,
            },
            on: (event: string, handler: (payload: any) => void) => {
                listeners[event] ??= [];
                listeners[event].push(handler);
                return () => {
                    listeners[event] = (listeners[event] ?? []).filter((entry) => entry !== handler);
                };
            },
            setHighlighted: vi.fn(),
        },
    };
}

const workspace = {
    services: {
        data: {
            101: { id: 101, name: 'Compatible Active Service', category: 'Payments', flags: { safe: { enabled: true } }, meta: { type: 'growth' } },
            202: { id: 202, name: 'Incompatible Available Service', category: 'Routing', flags: { instant: { enabled: true } }, meta: { delivery: { speed: 'fast' } } },
        },
    },
    policies: {
        policies: {
            data: [],
        },
    },
};

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => canvasMock,
    useWorkspace: () => workspace,
}));

vi.mock('@/workspace/fallback-editor-modal.tsx', () => ({
    useFallbackEditorModal: () => ({ openForService: vi.fn() }),
}));

vi.mock('@/workspace/fallback-quick-add.tsx', () => ({
    useFallbackQuickAdd: () => ({ openForService: vi.fn() }),
}));

vi.mock('@/components/ui/panel.tsx', async () => {
    const React = await import('react');
    return {
        Panel: React.forwardRef<HTMLDivElement, any>(({ children, className, style }, ref) => (
            <div ref={ref} className={className} style={style}>
                {children}
            </div>
        )),
    };
});

vi.mock('@/components/ui/scroll-area.tsx', () => ({
    ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/resizable.tsx', () => ({
    ResizablePanelGroup: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
    ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResizableHandle: () => <div />,
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ variant, label, value, onChange, options, placeholder, disabled, autoComplete }: any) => {
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
                <select
                    aria-label={ariaLabel}
                    value={value ?? ''}
                    disabled={disabled}
                    onChange={(event) => onChange?.({ value: event.target.value || undefined })}
                >
                    <option value="">{placeholder ?? 'Select'}</option>
                    {flattenedOptions.map((option: any) => (
                        <option key={String(option.key)} value={option.key}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }
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
                type={variant === 'number' ? 'number' : 'text'}
                value={value ?? ''}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                onChange={(event) => onChange?.({ value: event.target.value })}
            />
        );
    },
}));

vi.mock('./console-tab.tsx', () => ({
    ConsoleTab: () => <div>Console</div>,
}));

function renderPanel() {
    return render(
        <BottomConsolePanel
            controller={{
                isOpen: true,
                activeTab: 'allServices',
                width: 960,
                height: 320,
                toggle: vi.fn(),
                open: vi.fn(),
                close: vi.fn(),
                setActiveTab: vi.fn(),
                setWidth: vi.fn(),
                setHeight: vi.fn(),
                shortcutLabel: 'Ctrl/Cmd + J',
            }}
            errors={{ validation: [], logs: [], validating: false } as any}
            activeServices={[
                {
                    id: 101,
                    name: 'Compatible Active Service',
                    flags: [],
                    attachmentCount: 1,
                    attachedNodeIds: [],
                    attachedNodeLabels: [],
                    active: true,
                },
            ]}
            allServices={[
                {
                    id: 101,
                    name: 'Compatible Active Service',
                    flags: [],
                    attachmentCount: 1,
                    attachedNodeIds: [],
                    attachedNodeLabels: [],
                    active: true,
                },
                {
                    id: 202,
                    name: 'Incompatible Available Service',
                    flags: [],
                    attachmentCount: 0,
                    attachedNodeIds: [],
                    attachedNodeLabels: [],
                    active: false,
                },
            ]}
        />,
    );
}

function getPopoverCheckbox(label: string) {
    const text = screen.getByText(label);
    const row = text.closest('label');
    if (!row) throw new Error(`Unable to locate checkbox row for ${label}`);
    const input = row.querySelector('input[type="checkbox"]');
    if (!(input instanceof HTMLInputElement)) throw new Error(`Unable to locate checkbox input for ${label}`);
    return input;
}

function clickPopoverCheckbox(label: string) {
    const input = getPopoverCheckbox(label);
    fireEvent.click(input);
}

async function clickHideServicesCheckbox(label: string) {
    if (!screen.queryByText(label)) {
        fireEvent.click(screen.getByRole('button', { name: 'Hide services options' }));
    }
    const text = await screen.findByText(label);
    const row = text.closest('label');
    if (!row) throw new Error(`Unable to locate hide-services row for ${label}`);
    const input = row.querySelector('input[type="checkbox"]');
    if (!(input instanceof HTMLInputElement)) throw new Error(`Unable to locate hide-services checkbox for ${label}`);
    fireEvent.click(input);
}

function flattenTreeOptions(options: Array<any>): Array<any> {
    return options.flatMap((option) => [option, ...flattenTreeOptions(option.children ?? [])]);
}

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

describe('BottomConsolePanel service catalog', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
        selectedButtonsState = ['o:fast'];
        canvasMock = makeCanvas();
        catalogState = {
            version: 1,
            nodes: [{ id: 'cg:1', kind: 'group', label: 'Payments', serviceIds: [101] }],
            activeNodeId: undefined,
            expandedIds: [],
            pinnedNodeIds: [],
            selectedServiceId: undefined,
            viewMode: 'all',
        };
        listeners = {};
        filterServicesForVisibleGroup.mockReset();
        createCatalogGroup.mockReset();
        updateCatalogNode.mockReset();
        removeCatalogNode.mockReset();
        assignServicesToCatalogGroup.mockReset();
        setCatalogViewMode.mockReset();
        setSelectedCatalogService.mockReset();
        setActiveCatalogNode.mockReset();
        setCatalogExpanded.mockReset();
        patchProps.mockReset();
        replaceProps.mockReset();
        transact.mockReset();
        filterServicesForVisibleGroup.mockReturnValue([
            { id: 101, ok: true, fitsConstraints: true, passesRate: true, passesPolicies: true, reasons: [] },
            { id: 202, ok: false, fitsConstraints: false, passesRate: true, passesPolicies: true, reasons: ['constraint_mismatch'] },
        ]);
    });

    it('uses manual popover context by default and applies compatibility independently from used services', async () => {
        renderPanel();

        await waitFor(() => {
            expect(filterServicesForVisibleGroup).toHaveBeenCalledWith(
                [101, 202],
                expect.objectContaining({
                    tagId: 't:root',
                    selectedButtons: [],
                    usedServiceIds: ['101'],
                }),
            );
        });

        expect(screen.getAllByText('Compatible Active Service').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Incompatible Available Service').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Catalog context filter' }));
        await screen.findByText('Compatible only');
        clickPopoverCheckbox('Compatible only');

        await waitFor(() => {
            expect(screen.getAllByText('Compatible Active Service').length).toBeGreaterThan(0);
            expect(screen.queryByText('Incompatible Available Service')).not.toBeInTheDocument();
        });
    });

    it('keeps hide active separate from compatibility filtering', async () => {
        renderPanel();

        await clickHideServicesCheckbox('Hide active services');

        await waitFor(() => {
            expect(screen.queryByText('Compatible Active Service')).not.toBeInTheDocument();
            expect(screen.getAllByText('Incompatible Available Service').length).toBeGreaterThan(0);
        });

        fireEvent.click(screen.getByRole('button', { name: 'Catalog context filter' }));
        await screen.findByText('Compatible only');
        clickPopoverCheckbox('Compatible only');

        await waitFor(() => {
            expect(screen.queryByText('Compatible Active Service')).not.toBeInTheDocument();
            expect(screen.queryByText('Incompatible Available Service')).not.toBeInTheDocument();
        });
    });

    it('shows hide-services dropdown options with checkboxes', async () => {
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Hide services options' }));
        expect(screen.getByText('Hide active services')).toBeInTheDocument();
        expect(screen.getByText('Hide non-eligible for context')).toBeInTheDocument();
    });

    it('hides non-eligible services when requested', async () => {
        renderPanel();
        await clickHideServicesCheckbox('Hide non-eligible for context');

        await waitFor(() => {
            expect(screen.getAllByText('Compatible Active Service').length).toBeGreaterThan(0);
            expect(screen.queryByText('Incompatible Available Service')).not.toBeInTheDocument();
        });
    });

    it('combines both hide toggles', async () => {
        renderPanel();
        await clickHideServicesCheckbox('Hide active services');
        await clickHideServicesCheckbox('Hide non-eligible for context');

        await waitFor(() => {
            expect(screen.queryByText('Compatible Active Service')).not.toBeInTheDocument();
            expect(screen.queryByText('Incompatible Available Service')).not.toBeInTheDocument();
        });
    });

    it('marks hide-services trigger as active when any hide option is enabled', async () => {
        renderPanel();

        const hideButton = screen.getByRole('button', { name: 'Hide services options' });
        expect(hideButton.className).not.toContain('bg-blue-50');

        await clickHideServicesCheckbox('Hide non-eligible for context');

        await waitFor(() => {
            expect(hideButton.className).toContain('bg-blue-50');
        });
    });

    it('links to the current context only when explicitly enabled and preserves linked values after unlinking', async () => {
        renderPanel();

        await waitFor(() => {
            expect(filterServicesForVisibleGroup).toHaveBeenLastCalledWith(
                [101, 202],
                expect.objectContaining({ selectedButtons: [] }),
            );
        });

        fireEvent.click(screen.getByRole('button', { name: 'Catalog context filter' }));
        await screen.findByText('Link to current context');
        clickPopoverCheckbox('Strict safety');
        expect(getPopoverCheckbox('Strict safety').checked).toBe(false);

        clickPopoverCheckbox('Link to current context');

        await waitFor(() => {
            expect(getPopoverCheckbox('Link to current context').checked).toBe(true);
        });

        expect(getPopoverCheckbox('Strict safety').checked).toBe(true);
        expect(getPopoverCheckbox('Strict safety').disabled).toBe(true);

        clickPopoverCheckbox('Link to current context');

        await waitFor(() => {
            expect(getPopoverCheckbox('Link to current context').checked).toBe(false);
        });

        expect(getPopoverCheckbox('Strict safety').checked).toBe(true);
        expect(getPopoverCheckbox('Strict safety').disabled).toBe(false);
    });

    it('does not show the filter as active unless compatible-only is enabled', async () => {
        renderPanel();

        const filterButton = screen.getByRole('button', { name: 'Catalog context filter' });
        expect(filterButton.className).not.toContain('bg-blue-50');

        fireEvent.click(filterButton);
        await screen.findByText('Link to current context');
        clickPopoverCheckbox('Link to current context');

        await waitFor(() => {
            expect(getPopoverCheckbox('Link to current context').checked).toBe(true);
        });

        expect(filterButton.className).not.toContain('bg-blue-50');

        clickPopoverCheckbox('Compatible only');

        await waitFor(() => {
            expect(filterButton.className).toContain('bg-blue-50');
        });
    });

    it('passes custom primary rate context in all-services compatibility checks', async () => {
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Catalog context filter' }));
        await screen.findByText('Catalog context');
        fireEvent.click(screen.getByLabelText('Custom primary rate'));
        fireEvent.click(screen.getByLabelText('Manual rate'));
        fireEvent.change(screen.getByLabelText('Primary rate'), { target: { value: '12' } });

        await waitFor(() => {
            expect(filterServicesForVisibleGroup).toHaveBeenLastCalledWith(
                [101, 202],
                expect.objectContaining({
                    rateContext: expect.objectContaining({
                        mode: 'custom_primary_rate',
                        source: 'manual',
                        primaryRate: 12,
                    }),
                }),
            );
        });
    });

    it('expands and collapses the header search overlay', async () => {
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Search services' }));
        const input = screen.getAllByLabelText('Search services').find((element) => element.tagName === 'INPUT') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Compatible' } });
        fireEvent.blur(input);
        expect(screen.getAllByLabelText('Search services').some((element) => element.tagName === 'INPUT')).toBe(true);

        fireEvent.keyDown(input, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryAllByLabelText('Search services').some((element) => element.tagName === 'INPUT')).toBe(false);
        });
    });

    it('switches between All and Catalog modes and renders the catalog builder only in Catalog mode', async () => {
        renderPanel();

        expect(screen.queryByRole('button', { name: 'Create top-level group' })).not.toBeInTheDocument();
        expect(screen.getAllByText('Compatible Active Service').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Create top-level group' })).toBeInTheDocument();
            expect(screen.getByLabelText('Catalog group selector')).toBeInTheDocument();
            expect(screen.queryByText('Groups')).not.toBeInTheDocument();
            expect(screen.queryByText('Compatible Active Service')).not.toBeInTheDocument();
            expect(screen.getAllByText('Incompatible Available Service').length).toBeGreaterThan(0);
        });

        fireEvent.change(screen.getByLabelText('Catalog group selector'), { target: { value: 'cg:1' } });

        await waitFor(() => {
            expect(screen.getAllByText('Compatible Active Service').length).toBeGreaterThan(0);
            expect(screen.queryByText('Incompatible Available Service')).not.toBeInTheDocument();
        });
    });

    it('routes catalog builder actions through editor catalog APIs without touching props mutations or transactions', async () => {
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
        await screen.findByRole('button', { name: 'Create top-level group' });

        fireEvent.click(screen.getByRole('button', { name: 'Create top-level group' }));
        fireEvent.change(screen.getByLabelText('Create root group'), { target: { value: 'New Group' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => {
            expect(createCatalogGroup).toHaveBeenCalledWith({ label: 'New Group' });
            expect(setCatalogViewMode).toHaveBeenCalledWith('grouped');
            expect(patchProps).not.toHaveBeenCalled();
            expect(replaceProps).not.toHaveBeenCalled();
            expect(transact).not.toHaveBeenCalled();
        });
    });

    it('uses form-palette inputs for group naming and resets picker filters on reopen', async () => {
        catalogState.activeNodeId = 'cg:1';
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
        await screen.findByRole('button', { name: 'Create top-level group' });

        fireEvent.click(screen.getByRole('button', { name: 'Create top-level group' }));
        expect(screen.getByLabelText('Create root group')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Assign services to selected group' }));
        await screen.findByRole('dialog', { name: 'Service picker' });

        fireEvent.change(screen.getByLabelText('Picker search'), { target: { value: 'growth' } });
        expect((screen.getByLabelText('Picker search') as HTMLInputElement).value).toBe('growth');
        expect(screen.getByLabelText('Category filter')).toBeInTheDocument();

        const dialog = screen.getByRole('dialog', { name: 'Service picker' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Service picker' })).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Assign services to selected group' }));
        await screen.findByRole('dialog', { name: 'Service picker' });

        expect((screen.getByLabelText('Picker search') as HTMLInputElement).value).toBe('');
    });

    it('assigns multiple services to the active group through the picker dialog', async () => {
        catalogState.activeNodeId = 'cg:1';
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
        await screen.findByRole('button', { name: 'Assign services to selected group' });

        fireEvent.click(screen.getByRole('button', { name: 'Assign services to selected group' }));
        await screen.findByRole('dialog', { name: 'Service picker' });

        fireEvent.click(screen.getByLabelText('Select Compatible Active Service'));
        fireEvent.click(screen.getByLabelText('Select Incompatible Available Service'));
        fireEvent.click(screen.getByRole('button', { name: 'Add selected services' }));

        await waitFor(() => {
            expect(assignServicesToCatalogGroup).toHaveBeenCalledWith('cg:1', ['101', '202'], 'append');
            expect(patchProps).not.toHaveBeenCalled();
            expect(replaceProps).not.toHaveBeenCalled();
            expect(transact).not.toHaveBeenCalled();
        });
    });

    it('supports select-all for filtered services with tri-state behavior', async () => {
        catalogState.activeNodeId = 'cg:1';
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
        await screen.findByRole('button', { name: 'Assign services to selected group' });

        fireEvent.click(screen.getByRole('button', { name: 'Assign services to selected group' }));
        await screen.findByRole('dialog', { name: 'Service picker' });

        const selectAll = screen.getByLabelText('Select all filtered services') as HTMLInputElement;
        expect(selectAll.checked).toBe(false);
        expect(selectAll.getAttribute('aria-checked')).toBe('false');

        fireEvent.click(selectAll);
        expect((screen.getByLabelText('Select Compatible Active Service') as HTMLInputElement).checked).toBe(true);
        expect((screen.getByLabelText('Select Incompatible Available Service') as HTMLInputElement).checked).toBe(true);
        expect(selectAll.checked).toBe(true);

        fireEvent.click(screen.getByLabelText('Select Compatible Active Service'));
        expect(selectAll.checked).toBe(false);
        expect(selectAll.getAttribute('aria-checked')).toBe('mixed');

        fireEvent.change(screen.getByLabelText('Picker search'), { target: { value: 'Incompatible' } });
        await waitFor(() => {
            expect(screen.queryByLabelText('Select Compatible Active Service')).not.toBeInTheDocument();
        });

        const filteredSelectAll = screen.getByLabelText('Select all filtered services') as HTMLInputElement;
        expect(filteredSelectAll.checked).toBe(true);
        expect(filteredSelectAll.getAttribute('aria-checked')).toBe('true');

        fireEvent.click(filteredSelectAll);
        expect((screen.getByLabelText('Select Incompatible Available Service') as HTMLInputElement).checked).toBe(false);
    });

    it('shows the selected group chip beside the count and supports ungrouped via the toolbar treeselect', async () => {
        renderPanel();

        fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
        await screen.findByLabelText('Catalog group selector');

        expect(screen.getByText('Ungrouped', { selector: 'span' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Catalog group selector'), { target: { value: 'cg:1' } });

        await waitFor(() => {
            expect(setActiveCatalogNode).toHaveBeenCalledWith('cg:1');
            expect(screen.getByText('Payments', { selector: 'span' })).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Catalog group selector'), { target: { value: '__catalog_ungrouped__' } });

        await waitFor(() => {
            expect(setActiveCatalogNode).toHaveBeenCalledWith(undefined);
            expect(screen.getByText('Ungrouped', { selector: 'span' })).toBeInTheDocument();
            expect(screen.getAllByText('Incompatible Available Service').length).toBeGreaterThan(0);
        });
    });
});
