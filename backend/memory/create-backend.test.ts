import { beforeEach, describe, expect, it, vi } from 'vitest';

const baseBackendMock = {
    permissions: {
        get: vi.fn(async () => ({
            ok: true,
            value: {
                'workspace.read': true,
                'branches.read': true,
                'branches.create': true,
                'branches.write': true,
                'branches.delete': true,
                'branches.merge': true,
                'branches.publish': true,
                'branches.manage': true,
                'templates.write': true,
                'comments.read': true,
                'comments.write': true,
            },
        })),
    },
    access: {
        listParticipants: vi.fn(async () => ({
            ok: true,
            value: [
                {
                    id: 'part:1',
                    workspaceId: 'ws:local',
                    branchId: 'branch:main',
                    authorId: 'author:davy',
                    roles: ['editor'],
                    canRead: true,
                    canWrite: true,
                    createdAt: '2026-03-26T00:00:00.000Z',
                    updatedAt: '2026-03-26T00:00:00.000Z',
                },
            ],
        })),
    },
    branches: {
        create: vi.fn(async () => ({ ok: true, value: {} })),
        setMain: vi.fn(async () => ({ ok: true, value: {} })),
        merge: vi.fn(async () => ({ ok: true, value: {} })),
        delete: vi.fn(async () => ({ ok: true, value: undefined })),
    },
    templates: {
        list: vi.fn(async () => ({ ok: true, value: [] })),
        refresh: vi.fn(async () => ({ ok: true, value: [] })),
        create: vi.fn(async () => ({ ok: true, value: {} })),
        update: vi.fn(async () => ({ ok: true, value: {} })),
        clone: vi.fn(async () => ({ ok: true, value: {} })),
        publish: vi.fn(async () => ({ ok: true, value: {} })),
        unpublish: vi.fn(async () => ({ ok: true, value: {} })),
        delete: vi.fn(async () => ({ ok: true, value: undefined })),
    },
    snapshots: {
        autosave: vi.fn(async () => ({ ok: true, value: {} })),
        save: vi.fn(async () => ({ ok: true, value: {} })),
        publish: vi.fn(async () => ({ ok: true, value: {} })),
        discard: vi.fn(async () => ({ ok: true, value: {} })),
    },
    comments: {
        createThread: vi.fn(async () => ({ ok: true, value: { id: 'thread-1' } })),
        addMessage: vi.fn(async () => ({ ok: true, value: {} })),
        editMessage: vi.fn(async () => ({ ok: true, value: {} })),
        deleteMessage: vi.fn(async () => ({ ok: true, value: undefined })),
        moveThread: vi.fn(async () => ({ ok: true, value: {} })),
        resolveThread: vi.fn(async () => ({ ok: true, value: {} })),
        deleteThread: vi.fn(async () => ({ ok: true, value: undefined })),
    },
};

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    createMemoryWorkspaceBackend: vi.fn(() => baseBackendMock),
}));

const { workspaceBackend } = await import('./create-backend');

describe('workspaceBackend permission wrapper', () => {
    beforeEach(() => {
        baseBackendMock.permissions.get.mockClear();
        baseBackendMock.access.listParticipants.mockClear();
        Object.values(baseBackendMock.templates).forEach((fn) => fn.mockClear());
        Object.values(baseBackendMock.snapshots).forEach((fn) => fn.mockClear());
        Object.values(baseBackendMock.comments).forEach((fn) => fn.mockClear());
    });

    it('rejects snapshot writes for unknown actors', async () => {
        const result = await workspaceBackend.snapshots.save({
            workspaceId: 'ws:local',
            branchId: 'branch:main',
            actorId: 'actor:bot',
            message: 'test',
            snapshot: {
                schema_version: '1',
                data: {},
            },
        } as any);

        expect(result.ok).toBe(false);
        expect((result as any).error?.code).toBe('forbidden');
        expect(baseBackendMock.snapshots.save).not.toHaveBeenCalled();
    });

    it('allows comment thread creation for the configured actor when comment write is enabled', async () => {
        const result = await workspaceBackend.comments.createThread(
            {
                workspaceId: 'ws:local',
                branchId: 'branch:main',
            } as any,
            {
                body: 'hello',
                anchor: { type: 'free', position: { x: 10, y: 12 } },
            } as any,
        );

        expect(result.ok).toBe(true);
        expect(baseBackendMock.comments.createThread).toHaveBeenCalledTimes(1);
    });

    it('normalizes template create branchId null to undefined for authorization/backend', async () => {
        const result = await workspaceBackend.templates.create('ws:local', {
            name: 'Template A',
            kind: 'text',
            branchId: null,
            definition: { type: 'text' },
        } as any);

        expect(result.ok).toBe(true);
        expect(baseBackendMock.access.listParticipants).not.toHaveBeenCalled();
        expect(baseBackendMock.templates.create).toHaveBeenCalledWith(
            'ws:local',
            expect.objectContaining({
                branchId: undefined,
            }),
        );
    });

    it('normalizes template clone branchId null to undefined for authorization/backend', async () => {
        const result = await workspaceBackend.templates.clone(
            { id: 'tpl:1' },
            {
                name: 'Clone',
                branchId: null,
            } as any,
        );

        expect(result.ok).toBe(true);
        expect(baseBackendMock.access.listParticipants).not.toHaveBeenCalled();
        expect(baseBackendMock.templates.clone).toHaveBeenCalledWith(
            { id: 'tpl:1' },
            expect.objectContaining({
                branchId: undefined,
            }),
        );
    });

    it('returns branch + global templates on refresh when branchId is provided', async () => {
        baseBackendMock.templates.refresh.mockResolvedValueOnce({
            ok: true,
            value: [
                { id: 'tpl:global', name: 'Global', branchId: undefined },
                { id: 'tpl:main', name: 'Main', branchId: 'branch:main' },
                { id: 'tpl:exp', name: 'Exp', branchId: 'branch:experiment' },
            ],
        });

        const result = await workspaceBackend.templates.refresh({
            workspaceId: 'ws:local',
            branchId: 'branch:main',
        } as any);

        expect(result.ok).toBe(true);
        expect(baseBackendMock.templates.refresh).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: 'ws:local',
                branchId: 'branch:main',
            }),
        );
        expect((result as any).value).toEqual([
            { id: 'tpl:global', name: 'Global', branchId: undefined },
            { id: 'tpl:main', name: 'Main', branchId: 'branch:main' },
        ]);
    });

    it('returns branch + global templates on list when branchId is provided', async () => {
        baseBackendMock.templates.list.mockResolvedValueOnce({
            ok: true,
            value: [
                { id: 'tpl:global', name: 'Global', branchId: undefined },
                { id: 'tpl:main', name: 'Main', branchId: 'branch:main' },
                { id: 'tpl:exp', name: 'Exp', branchId: 'branch:experiment' },
            ],
        });

        const result = await workspaceBackend.templates.list({
            workspaceId: 'ws:local',
            branchId: 'branch:main',
        } as any);

        expect(result.ok).toBe(true);
        expect(baseBackendMock.templates.list).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: 'ws:local',
                branchId: 'branch:main',
            }),
        );
        expect((result as any).value).toEqual([
            { id: 'tpl:global', name: 'Global', branchId: undefined },
            { id: 'tpl:main', name: 'Main', branchId: 'branch:main' },
        ]);
    });
});
