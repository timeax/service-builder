import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NodeContextMenuProvider } from './node-context-menu.tsx';

const createTemplate = vi.fn(async () => ({ ok: true, value: {} }));
const refreshTemplates = vi.fn(async () => ({ ok: true, value: [] }));

vi.mock('@/workspace/authorization.ts', () => ({
    deriveWorkspaceAuthorization: vi.fn(() => ({
        canEditBranchContent: true,
        canWriteTemplates: true,
    })),
    getAuthorizationDecision: vi.fn(() => ({ ok: true })),
}));

vi.mock('./node-context/hooks.ts', () => ({
    useDropHandling: () => ({
        canAcceptDropPayload: () => false,
        handleNodeDrop: () => false,
        actionsForIntent: () => [],
    }),
    useNoticeHandling: () => ({
        notices: [],
        nodeOptions: [],
        handleNoticeSave: vi.fn(),
        handleNoticeDelete: vi.fn(),
        handleUseCurrentSelection: vi.fn(),
    }),
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        selector: {
            getNode: vi.fn((id: string) => ({
                id,
                kind: 'field',
                raw: { label: 'Amount', type: 'text', defaults: { required: true } },
            })),
        },
        api: {
            emit: vi.fn(),
            select: vi.fn(),
            builder: {
                getProps: () => ({
                    fields: [
                        {
                            id: 'f:amount',
                            label: 'Amount',
                            type: 'text',
                            required: true,
                        },
                    ],
                }),
            },
            editor: {
                editLabel: vi.fn(),
                remove: vi.fn(),
                disconnect: vi.fn(),
                connect: vi.fn(),
            },
        },
        setActive: vi.fn(),
    }),
    useWorkspace: () => ({
        actor: { id: 'actor:1' },
        permissions: { data: {} },
        participants: { data: [] },
        authors: { data: [] },
        branches: { currentId: 'branch:main' },
        createTemplate,
        refresh: { templates: refreshTemplates },
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ value, onChange, variant, options }: any) => {
        if (variant === 'toggle-group') {
            return (
                <button type="button" onClick={() => onChange?.({ value: options?.[0]?.value ?? 'single' })}>
                    Toggle
                </button>
            );
        }
        return <input value={value ?? ''} onChange={(event) => onChange?.({ value: event.target.value })} />;
    },
}));

describe('NodeContextMenuProvider template save scope', () => {
    beforeEach(() => {
        createTemplate.mockClear();
        refreshTemplates.mockClear();
    });

    it('requires name and sends branchId null when save-to-current-branch is unchecked', async () => {
        render(
            <NodeContextMenuProvider>
                <div>Child</div>
            </NodeContextMenuProvider>,
        );

        act(() => {
            window.dispatchEvent(
                new CustomEvent('service-builder:open-template-save-dialog', {
                    detail: { nodeId: 'f:amount' },
                }),
            );
        });

        const nameInput = await screen.findByRole('textbox');
        fireEvent.change(nameInput, { target: { value: 'Global Amount Template' } });
        const scopeCheckbox = screen.getByText('Save to current branch').closest('label')?.querySelector('input[type="checkbox"]');
        expect(scopeCheckbox).toBeTruthy();
        fireEvent.click(scopeCheckbox as HTMLInputElement);
        fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

        await waitFor(() => expect(createTemplate).toHaveBeenCalledTimes(1));
        expect(createTemplate.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                name: 'Global Amount Template',
                branchId: null,
            }),
        );
        expect(refreshTemplates).toHaveBeenCalled();
    });
});
