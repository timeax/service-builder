import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssetsPanel from './index.tsx';

const refreshTemplates = vi.fn(async () => ({ ok: true, value: [] }));
const updateTemplate = vi.fn(async () => ({ ok: true, value: {} }));
const cloneTemplate = vi.fn(async () => ({ ok: true, value: {} }));
const deleteTemplate = vi.fn(async () => ({ ok: true, value: undefined }));

vi.mock('@timeax/digital-service-engine/react', () => ({
    useInputs: () => ({
        registry: {
            _store: new Map([
                [
                    'text',
                    new Map([
                        ['default', {}],
                        ['multiline', {}],
                    ]),
                ],
            ]),
        },
    }),
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useWorkspace: () => ({
        templates: {
            data: [
                {
                    id: 'tpl:1',
                    name: 'Amount Template',
                    kind: 'text',
                    definition: { mode: 'single', type: 'text' },
                },
            ],
        },
        branches: { currentId: 'branch:main' },
        boot: {},
        refresh: { templates: refreshTemplates },
        updateTemplate,
        cloneTemplate,
        deleteTemplate,
    }),
}));

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ value, onChange, placeholder, icon, trailingControl }: any) => (
        <label>
            {icon}
            <input value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange?.({ value: event.target.value })} />
            {trailingControl}
        </label>
    ),
}));

vi.mock('@/workspace/boot-status.tsx', () => ({
    WorkspaceBootInlineNotice: () => null,
}));

describe.skip('AssetsPanel template context actions', () => {
    beforeEach(() => {
        refreshTemplates.mockClear();
        updateTemplate.mockClear();
        cloneTemplate.mockClear();
        deleteTemplate.mockClear();
    });

    async function openTemplateContextMenu() {
        render(<AssetsPanel />);
        const templateCardLabel = screen.getByText('Amount Template');
        fireEvent(
            templateCardLabel,
            new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 120,
                clientY: 140,
            }),
        );
        await screen.findByText('Rename template');
    }

    it('opens template context menu on right click', async () => {
        await openTemplateContextMenu();
        expect(screen.getByText('Rename template')).toBeInTheDocument();
        expect(screen.getByText('Clone template')).toBeInTheDocument();
        expect(screen.getByText('Delete template')).toBeInTheDocument();
    });

    it('renames template and sends branch id when checked', async () => {
        await openTemplateContextMenu();
        fireEvent.click(screen.getByText('Rename template'));
        const input = screen.getByPlaceholderText('Template name');
        fireEvent.change(input, { target: { value: 'Renamed Template' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(updateTemplate).toHaveBeenCalledTimes(1));
        expect(updateTemplate).toHaveBeenCalledWith('tpl:1', {
            name: 'Renamed Template',
            branchId: 'branch:main',
        });
        expect(refreshTemplates).toHaveBeenCalled();
    });

    it('clones template with branchId null when unchecked', async () => {
        await openTemplateContextMenu();
        fireEvent.click(screen.getByText('Clone template'));
        const checkbox = screen.getByText('Save to current branch').closest('label')?.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeTruthy();
        fireEvent.click(checkbox as HTMLInputElement);
        fireEvent.click(screen.getByRole('button', { name: 'Clone' }));

        await waitFor(() => expect(cloneTemplate).toHaveBeenCalledTimes(1));
        expect(cloneTemplate).toHaveBeenCalledWith(
            { id: 'tpl:1' },
            expect.objectContaining({
                name: 'Copy of Amount Template',
                branchId: null,
            }),
        );
        expect(refreshTemplates).toHaveBeenCalled();
    });

    it('deletes template from context menu', async () => {
        await openTemplateContextMenu();
        fireEvent.click(screen.getByText('Delete template'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith('tpl:1'));
        expect(refreshTemplates).toHaveBeenCalled();
    });
});
