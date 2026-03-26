import { beforeEach, describe, expect, it, vi } from 'vitest';

const baseBackendMock = {
    permissions: {
        get: vi.fn(async () => ({
            ok: true,
            value: {
                'workspace.read': true,
                'workspace.write': true,
                'branches.create': true,
                'branches.merge': true,
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
});
