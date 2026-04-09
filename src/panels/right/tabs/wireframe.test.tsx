import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Wireframe from './wireframe.tsx';

const {
    mockUseCanvas,
    mockUseWorkspace,
    mockUseOrderFlow,
    mockGetCurrentTag,
    mockGetVisiblePreviewFields,
} = vi.hoisted(() => ({
    mockUseCanvas: vi.fn(),
    mockUseWorkspace: vi.fn(),
    mockUseOrderFlow: vi.fn(),
    mockGetCurrentTag: vi.fn(),
    mockGetVisiblePreviewFields: vi.fn(),
}));

vi.mock('@/builder/node-context-menu.tsx', () => ({
    useNodeContextMenu: () => ({
        openNodeContextMenu: vi.fn(),
        canAcceptDropPayload: () => false,
        handleNodeDrop: vi.fn(),
    }),
}));

vi.mock('@/builder/view-models.tsx', () => ({
    getCurrentTag: () => mockGetCurrentTag(),
    getVisiblePreviewFields: () => mockGetVisiblePreviewFields(),
}));

vi.mock('@/components/builder', () => ({
    EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/panels/right/components/wireframe-tags-widget.tsx', () => ({
    __esModule: true,
    default: () => <div data-testid="wireframe-tags-widget" />,
}));

vi.mock('@/workspace/boot-status.tsx', () => ({
    WorkspaceBootInlineNotice: () => null,
}));

vi.mock('@timeax/digital-service-engine/react', () => ({
    useOrderFlow: () => mockUseOrderFlow(),
    Wrapper: () => <div data-testid="field-wrapper" />,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => mockUseCanvas(),
    useWorkspace: () => mockUseWorkspace(),
}));

function makeCanvas(optionIds: string[] = []) {
    return {
        props: {},
        activeId: 't:sample',
        selectionInfo: { optionIds },
        setActive: vi.fn(),
        api: {
            select: vi.fn(),
            builder: {
                getProps: () => ({ notices: [] }),
            },
            selection: {
                visibleGroup: () => ({
                    kind: 'single',
                    group: {
                        tag: null,
                        tagId: null,
                        parentTags: [],
                        childrenTags: [],
                        fields: [],
                        fieldIds: [],
                    },
                }),
            },
        },
    };
}

function makeFlow(overrides: Record<string, unknown> = {}) {
    const snapshot = {
        orderKind: 'contract',
        orderKindSource: { nodeKind: 'field', nodeId: 'f:mode' },
    };

    return {
        ready: true,
        min: 100,
        max: 2000,
        quantityPreview: 1500,
        services: ['101', '202'],
        activeTagId: 't:sample',
        formValuesByFieldId: {},
        optionSelectionsByFieldId: {},
        pricingPreview: {
            base: 12.5,
            utilities: 2,
            total: 14.5,
            utilityBreakdown: [{ nodeId: 'n:1', mode: 'flat', amount: 2 }],
        },
        buildSnapshot: () => snapshot,
        visibleGroup: null,
        ...overrides,
    };
}

describe('Wireframe footer summary', () => {
    beforeEach(() => {
        mockUseWorkspace.mockReset();
        mockUseCanvas.mockReset();
        mockUseOrderFlow.mockReset();
        mockGetCurrentTag.mockReset();
        mockGetVisiblePreviewFields.mockReset();

        mockUseWorkspace.mockReturnValue({
            boot: { isReady: true },
            services: {
                data: {
                    '101': { id: '101', name: 'Instagram Followers', rate: 12.5, min: 100, max: 10000 },
                    '202': { id: '202', name: 'Instagram Likes', rate: 2, min: 50, max: 5000 },
                },
            },
        });
        mockUseCanvas.mockReturnValue(makeCanvas(['o:1', 'o:2', 'o:3']));
        mockUseOrderFlow.mockReturnValue(makeFlow());
        mockGetCurrentTag.mockReturnValue({ raw: { label: 'Instagram' } });
        mockGetVisiblePreviewFields.mockReturnValue([{ id: 'f:1' }, { id: 'f:2' }]);
    });

    it('renders footer summary chips with quantity, range, pricing, and counts', () => {
        render(<Wireframe />);

        expect(screen.getByRole('button', { name: 'Order preview summary' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Tag:')).toBeInTheDocument();
        expect(screen.getByText('Instagram')).toBeInTheDocument();
        expect(screen.getByText('Visible fields:')).toBeInTheDocument();
        expect(screen.getByText('Selected options:')).toBeInTheDocument();
        expect(screen.getByText('Quantity:')).toBeInTheDocument();
        expect(screen.getByText('1,500')).toBeInTheDocument();
        expect(screen.getByText('Min/Max:')).toBeInTheDocument();
        expect(screen.getByText('100 - 2,000')).toBeInTheDocument();
        expect(screen.getByText('Order kind:')).toBeInTheDocument();
        expect(screen.getByText('contract')).toBeInTheDocument();
        expect(screen.getByText('Order kind source:')).toBeInTheDocument();
        expect(screen.getByText('field:f:mode')).toBeInTheDocument();
        expect(screen.getByText('Services:')).toBeInTheDocument();
        expect(screen.getByText('Base:')).toBeInTheDocument();
        expect(screen.getByText('12.5')).toBeInTheDocument();
        expect(screen.getByText('Utilities:')).toBeInTheDocument();
        expect(screen.getByText('Total:')).toBeInTheDocument();
        expect(screen.getByText('14.5')).toBeInTheDocument();
        expect(screen.getByText('Utility lines:')).toBeInTheDocument();
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3').length).toBeGreaterThan(0);
        expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    it('supports collapsing and expanding the footer summary', () => {
        render(<Wireframe />);

        const toggle = screen.getByRole('button', { name: 'Order preview summary' });
        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Tag:')).not.toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Tag:')).toBeInTheDocument();
    });

    it('opens a services popover when the services pill is clicked', async () => {
        render(<Wireframe />);

        fireEvent.click(screen.getByRole('button', { name: 'Services details' }));

        expect(await screen.findByText('Visible Services')).toBeInTheDocument();
        expect(screen.getByText('Instagram Followers')).toBeInTheDocument();
        expect(screen.getByText('Instagram Likes')).toBeInTheDocument();
    });

    it('renders fallback placeholders for invalid numeric pricing values and no active tag', () => {
        mockUseOrderFlow.mockReturnValue(
            makeFlow({
                min: Number.NaN,
                max: Number.POSITIVE_INFINITY,
                quantityPreview: Number.NaN,
                ready: false,
                buildSnapshot: () => undefined,
                pricingPreview: {
                    base: Number.NaN,
                    utilities: undefined,
                    total: Number.POSITIVE_INFINITY,
                    utilityBreakdown: [],
                },
                services: [],
            }),
        );
        mockGetCurrentTag.mockReturnValue(null);
        mockGetVisiblePreviewFields.mockReturnValue([]);
        mockUseCanvas.mockReturnValue(makeCanvas([]));

        render(<Wireframe />);

        expect(screen.getByText('No active tag')).toBeInTheDocument();
        expect(screen.getByText('Utility lines:')).toBeInTheDocument();
        expect(screen.getAllByText('0').length).toBeGreaterThan(0);
        expect(screen.getAllByText('--').length).toBeGreaterThan(0);
    });
});
