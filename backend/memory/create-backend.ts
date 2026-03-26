// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-nocheck
import { createMemoryWorkspaceBackend } from '@timeax/digital-service-engine/workspace';
import { deriveWorkspaceAuthorization, getAuthorizationDecision } from '@/workspace/authorization.ts';

import { seed } from './seed';
import { workspaceActor } from './seed/meta';

const baseBackend = createMemoryWorkspaceBackend({
    workspaceId: 'ws:local',
    actorId: workspaceActor.id,
    ensureMain: true,
    ensureActorAuthor: true,
    seed,
});

function forbidden(message: string, meta?: Record<string, unknown>) {
    return {
        ok: false as const,
        error: {
            code: 'forbidden',
            message,
            meta,
        },
    };
}

async function resolveAuthForBranch(branchId: string | undefined) {
    const permissionsResult = await baseBackend.permissions.get(seed.info.id, workspaceActor);
    if (!permissionsResult.ok) return permissionsResult;

    const participantsResult =
        branchId != null
            ? await baseBackend.access.listParticipants(seed.info.id, branchId)
            : ({ ok: true as const, value: [] as const } as const);
    if (!participantsResult.ok) return participantsResult;

    const auth = deriveWorkspaceAuthorization({
        actor: workspaceActor,
        permissions: permissionsResult.value,
        participants: participantsResult.value,
    });

    return { ok: true as const, value: auth };
}

async function authorize(
    action:
        | 'branch-content-edit'
        | 'snapshot-write'
        | 'template-write'
        | 'branch-create'
        | 'branch-merge'
        | 'branch-publish'
        | 'branch-delete'
        | 'branch-manage'
        | 'comment-write',
    branchId: string | undefined,
) {
    const authResult = await resolveAuthForBranch(branchId);
    if (!authResult.ok) return authResult;

    const decision = getAuthorizationDecision(authResult.value, action);
    if (!decision.ok) return forbidden(decision.reason ?? 'Permission denied.', { action, branchId });

    return { ok: true as const };
}

export const workspaceBackend = {
    ...baseBackend,
    branches: {
        ...baseBackend.branches,
        create: async (workspaceId: string, name: string, options?: { fromId?: string }) => {
            const check = await authorize('branch-create', options?.fromId);
            if (!check.ok) return check;
            return baseBackend.branches.create(workspaceId, name, options);
        },
        setMain: async (workspaceId: string, branchId: string) => {
            const check = await authorize('branch-manage', branchId);
            if (!check.ok) return check;
            return baseBackend.branches.setMain(workspaceId, branchId);
        },
        merge: async (workspaceId: string, sourceId: string, targetId: string) => {
            const sourceCheck = await authorize('branch-merge', sourceId);
            if (!sourceCheck.ok) return sourceCheck;
            const targetCheck = await authorize('branch-merge', targetId);
            if (!targetCheck.ok) return targetCheck;
            return baseBackend.branches.merge(workspaceId, sourceId, targetId);
        },
        delete: async (workspaceId: string, branchId: string) => {
            const check = await authorize('branch-delete', branchId);
            if (!check.ok) return check;
            return baseBackend.branches.delete(workspaceId, branchId);
        },
    },
    templates: {
        ...baseBackend.templates,
        create: async (
            workspaceId: string,
            input: {
                branchId?: string;
            } & Record<string, unknown>,
        ) => {
            const check = await authorize('template-write', input.branchId);
            if (!check.ok) return check;
            return baseBackend.templates.create(workspaceId, input as any);
        },
        update: async (id: string, patch: { branchId?: string | null } & Record<string, unknown>) => {
            const check = await authorize('template-write', patch.branchId ?? undefined);
            if (!check.ok) return check;
            return baseBackend.templates.update(id, patch as any);
        },
        clone: async (source: { id?: string; key?: string }, options?: { branchId?: string; asDraft?: boolean; name?: string; newKey?: string }) => {
            const check = await authorize('template-write', options?.branchId);
            if (!check.ok) return check;
            return baseBackend.templates.clone(source as any, options as any);
        },
        publish: async (id: string) => {
            const check = await authorize('template-write', undefined);
            if (!check.ok) return check;
            return baseBackend.templates.publish(id);
        },
        unpublish: async (id: string) => {
            const check = await authorize('template-write', undefined);
            if (!check.ok) return check;
            return baseBackend.templates.unpublish(id);
        },
        delete: async (id: string) => {
            const check = await authorize('template-write', undefined);
            if (!check.ok) return check;
            return baseBackend.templates.delete(id);
        },
    },
    snapshots: {
        ...baseBackend.snapshots,
        autosave: async (params: { branchId: string; actorId: string } & Record<string, unknown>) => {
            if (params.actorId !== workspaceActor.id) return forbidden('Snapshot mutation denied for unknown actor.', { actorId: params.actorId });
            const check = await authorize('snapshot-write', params.branchId);
            if (!check.ok) return check;
            return baseBackend.snapshots.autosave(params as any);
        },
        save: async (params: { branchId: string; actorId: string } & Record<string, unknown>) => {
            if (params.actorId !== workspaceActor.id) return forbidden('Snapshot mutation denied for unknown actor.', { actorId: params.actorId });
            const check = await authorize('snapshot-write', params.branchId);
            if (!check.ok) return check;
            return baseBackend.snapshots.save(params as any);
        },
        publish: async (params: { actorId: string } & Record<string, unknown>) => {
            if (params.actorId !== workspaceActor.id) return forbidden('Snapshot mutation denied for unknown actor.', { actorId: params.actorId });
            const check = await authorize('branch-publish', undefined);
            if (!check.ok) return check;
            return baseBackend.snapshots.publish(params as any);
        },
        discard: async (params: { actorId: string } & Record<string, unknown>) => {
            if (params.actorId !== workspaceActor.id) return forbidden('Snapshot mutation denied for unknown actor.', { actorId: params.actorId });
            const check = await authorize('snapshot-write', undefined);
            if (!check.ok) return check;
            return baseBackend.snapshots.discard(params as any);
        },
    },
    comments: {
        ...baseBackend.comments,
        createThread: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.createThread(ctx as any, input as any);
        },
        addMessage: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.addMessage(ctx as any, input as any);
        },
        editMessage: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.editMessage(ctx as any, input as any);
        },
        deleteMessage: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.deleteMessage(ctx as any, input as any);
        },
        moveThread: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.moveThread(ctx as any, input as any);
        },
        resolveThread: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.resolveThread(ctx as any, input as any);
        },
        deleteThread: async (ctx: { branchId: string } & Record<string, unknown>, input: Record<string, unknown>) => {
            const check = await authorize('comment-write', ctx.branchId);
            if (!check.ok) return check;
            return baseBackend.comments.deleteThread(ctx as any, input as any);
        },
    },
};
