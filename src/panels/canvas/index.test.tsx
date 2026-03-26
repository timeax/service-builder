import { render, screen } from '@testing-library/react';
import CanvasPanel from './index.tsx';

const workspaceState: any = {
    info: { id: 'ws-1' },
    branches: { currentId: 'branch:main' },
    actor: { id: 'actor:davy', name: 'Davy', meta: { authorId: 'author:davy' } },
    permissions: { data: { 'workspace.read': true, 'workspace.write': true, 'comments.read': true, 'comments.write': true } },
    participants: {
        data: [{ authorId: 'author:davy', canRead: true, canWrite: true }],
    },
    authors: { data: [{ id: 'author:davy', name: 'Davy' }] },
    boot: {
        isBooting: true,
        isReady: false,
        hasErrors: false,
        hasPartialFailure: false,
        isSeededView: true,
        isLiveConfirmed: false,
        completedSections: 3,
        succeededSections: 2,
        failedSections: 0,
        totalSections: 10,
        sections: {
            authors: { status: 'loading' },
            permissions: { status: 'loading' },
            branches: { status: 'success' },
            services: { status: 'success' },
            participants: { status: 'idle' },
            templates: { status: 'idle' },
            snapshotPointers: { status: 'idle' },
            snapshotBody: { status: 'loading' },
            policies: { status: 'idle' },
            comments: { status: 'idle' },
        },
        errorsBySection: {},
        retryAll: vi.fn(async () => ({ ok: true })),
        retrySection: vi.fn(async () => ({ ok: true, value: undefined })),
    },
    comments: { threads: { data: [] } },
    snapshot: {
        draft: undefined,
        set: vi.fn(),
        save: vi.fn(async () => ({ ok: true, value: { commit: {} } })),
        publish: vi.fn(async () => ({ ok: true, value: { commit: {} } })),
    },
};

const canvasState: any = {
    graph: { nodes: [{ id: 'n1', kind: 'field', label: 'Field' }], edges: [] },
    layers: { tags: [{ id: 't:root' }], fields: [{ id: 'f:field' }] },
    activeId: null,
    selectionInfo: { ids: [], optionIds: [] },
    selection: [],
    props: { filters: [], fields: [] },
    selector: { getNode: vi.fn(() => ({ id: 'n1', kind: 'field', raw: { label: 'Field' } })) },
    setActive: vi.fn(),
    api: {
        on: vi.fn(() => vi.fn()),
        selection: { currentTag: vi.fn(() => undefined) },
        builder: { visibleFields: vi.fn(() => []), getProps: vi.fn(() => ({ notices: [] })) },
        snapshot: vi.fn(() => ({
            graph: { nodes: [{ id: 'n1', kind: 'field', label: 'Field' }], edges: [] },
            positions: {},
            viewport: { x: 0, y: 0, zoom: 1 },
            highlighted: new Set<string>(),
        })),
        editor: {
            moduleCtx: { scope: 'test-editor' },
            undo: vi.fn(),
            redo: vi.fn(),
            editLabel: vi.fn(function (this: any) {
                return this.moduleCtx?.scope;
            }),
            getProps: vi.fn(() => ({ filters: [], fields: [] })),
        },
        emit: vi.fn(),
        setHighlighted: vi.fn(),
    },
};

vi.mock('@/builder/node-context-menu.tsx', () => ({
    useNodeContextMenu: () => ({
        openNodeContextMenu: vi.fn(),
        canAcceptDropPayload: vi.fn(() => false),
        handleNodeDrop: vi.fn(),
        toggleNoticeManager: vi.fn(),
        isNoticeManagerOpen: false,
    }),
}));

vi.mock('@/panels/right/partials/properties/components/node-capabilities.ts', () => ({
    getNodePropertyCapabilities: () => ({
        service: { canEdit: true },
    }),
}));

vi.mock('./flow-canvas.tsx', () => ({
    FlowCanvas: ({ children }: { children: React.ReactNode }) => <div data-testid="flow-canvas">{children}</div>,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => canvasState,
    useWorkspace: () => workspaceState,
}));

describe('CanvasPanel workspace boot integration', () => {
    it('shows seeded boot status while keeping the canvas visible', () => {
        render(
            <CanvasPanel
                errors={{ merged: { counts: { total: 0 }, validation: [] } } as any}
                bottomPanel={{ isOpen: false, toggle: vi.fn() } as any}
                draggingServiceId={null}
                onServiceDragStateChange={vi.fn()}
            />,
        );

        expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
        expect(screen.getByText('Showing seeded data while live sync continues')).toBeInTheDocument();
        const disabledBootActions = screen.getAllByTitle('Live workspace data is still syncing.');
        expect(disabledBootActions.length).toBeGreaterThanOrEqual(2);
        for (const action of disabledBootActions) expect(action).toBeDisabled();
    });

    it('updates from booting to ready and reports non-blocking issues cleanly', () => {
        const { rerender } = render(
            <CanvasPanel
                errors={{ merged: { counts: { total: 0 }, validation: [] } } as any}
                bottomPanel={{ isOpen: false, toggle: vi.fn() } as any}
                draggingServiceId={null}
                onServiceDragStateChange={vi.fn()}
            />,
        );

        workspaceState.boot = {
            ...workspaceState.boot,
            isBooting: false,
            isReady: true,
            hasErrors: true,
            hasPartialFailure: true,
            isSeededView: false,
            isLiveConfirmed: true,
            completedSections: 10,
            succeededSections: 9,
            failedSections: 1,
            sections: {
                ...workspaceState.boot.sections,
                authors: { status: 'success' },
                permissions: { status: 'success' },
                snapshotBody: { status: 'success' },
                comments: { status: 'error', error: { code: 'comment_failure', message: 'Comment refresh failed.' } },
            },
            errorsBySection: {
                comments: { code: 'comment_failure', message: 'Comment refresh failed.' },
            },
        };

        rerender(
            <CanvasPanel
                errors={{ merged: { counts: { total: 0 }, validation: [] } } as any}
                bottomPanel={{ isOpen: false, toggle: vi.fn() } as any}
                draggingServiceId={null}
                onServiceDragStateChange={vi.fn()}
            />,
        );

        expect(screen.getAllByText('Comment refresh failed.').length).toBeGreaterThan(0);
    });

    it('preserves editor method context when wrapper invokes edit methods', () => {
        const originalEditLabel = canvasState.api.editor.editLabel;
        render(
            <CanvasPanel
                errors={{ merged: { counts: { total: 0 }, validation: [] } } as any}
                bottomPanel={{ isOpen: false, toggle: vi.fn() } as any}
                draggingServiceId={null}
                onServiceDragStateChange={vi.fn()}
            />,
        );

        expect(() => canvasState.api.editor.editLabel('n1', 'Next Label')).not.toThrow();
        const result = canvasState.api.editor.editLabel('n1', 'Next Label');
        expect(result).toBe('test-editor');
        expect(originalEditLabel).toHaveBeenCalled();
    });
});
