import type { Actor, Author, BranchParticipant, PermissionsMap } from '@timeax/digital-service-engine/workspace';
import {
    can,
    canCreateBranch,
    canDeleteBranch,
    canEditBranch,
    canManageBranches,
    canManageTemplates,
    canMergeBranch,
    canPublishBranch,
    canReadComments,
    canReadWorkspace,
    canWriteComments,
    canWriteTemplates,
    toBuilderPermissionsMap,
    type BuilderPermission,
    type BuilderPermissionsMap,
} from '@/workspace/permissions.ts';

export type WorkspaceAuthorization = {
    authorId: string;
    participant: BranchParticipant | null;
    permissions: BuilderPermissionsMap;
    canReadWorkspace: boolean;
    canEditBranchContent: boolean;
    canCreateBranch: boolean;
    canMergeBranches: boolean;
    canPublishBranches: boolean;
    canDeleteBranches: boolean;
    canManageBranches: boolean;
    canWriteTemplates: boolean;
    canManageTemplates: boolean;
    canCommentRead: boolean;
    canCommentWrite: boolean;
};

export type AuthorizationAction =
    | 'branch-content-edit'
    | 'snapshot-write'
    | 'template-write'
    | 'branch-create'
    | 'branch-merge'
    | 'branch-publish'
    | 'branch-delete'
    | 'branch-manage'
    | 'comment-read'
    | 'comment-write';

type DeriveWorkspaceAuthorizationArgs = {
    actor?: Actor | null;
    permissions?: PermissionsMap | null;
    participants?: readonly BranchParticipant[] | null;
    authors?: readonly Author[] | null;
};

export function hasPermission(permissions: PermissionsMap | null | undefined, key: BuilderPermission): boolean {
    const map = toBuilderPermissionsMap(permissions);
    return can(map, key);
}

export function resolveActorAuthorId(actor: Actor | null | undefined, authors?: readonly Author[] | null): string {
    if (!actor) return 'unknown';
    const fromMeta =
        actor?.meta && typeof (actor.meta as Record<string, unknown>).authorId === 'string'
            ? ((actor.meta as Record<string, unknown>).authorId as string)
            : undefined;
    if (fromMeta) return fromMeta;
    if ((authors ?? []).some((author) => author.id === actor.id)) return actor.id;
    return actor.id;
}

export function deriveWorkspaceAuthorization(args: DeriveWorkspaceAuthorizationArgs): WorkspaceAuthorization {
    const { actor, permissions = null, participants = null, authors = null } = args;
    const authorId = resolveActorAuthorId(actor, authors);
    const participant = (participants ?? []).find((row) => row.authorId === authorId) ?? null;
    const permissionMap = toBuilderPermissionsMap(permissions);

    const readWorkspace = canReadWorkspace(permissionMap);
    const editBranch = canEditBranch(permissionMap);
    const createBranch = canCreateBranch(permissionMap);
    const mergeBranches = canMergeBranch(permissionMap);
    const publishBranches = canPublishBranch(permissionMap);
    const deleteBranches = canDeleteBranch(permissionMap);
    const manageBranches = canManageBranches(permissionMap);
    const writeTemplates = canWriteTemplates(permissionMap);
    const manageTemplates = canManageTemplates(permissionMap);
    const commentRead = canReadComments(permissionMap);
    const commentWrite = canWriteComments(permissionMap);

    return {
        authorId,
        participant,
        permissions: permissionMap,
        canReadWorkspace: readWorkspace,
        canEditBranchContent: editBranch,
        canCreateBranch: createBranch,
        canMergeBranches: mergeBranches,
        canPublishBranches: publishBranches,
        canDeleteBranches: deleteBranches,
        canManageBranches: manageBranches,
        canWriteTemplates: writeTemplates,
        canManageTemplates: manageTemplates,
        canCommentRead: readWorkspace && commentRead,
        canCommentWrite: readWorkspace && commentWrite,
    };
}

export function getAuthorizationDecision(auth: WorkspaceAuthorization, action: AuthorizationAction): { ok: boolean; reason?: string } {
    switch (action) {
        case 'branch-content-edit':
        case 'snapshot-write':
            return auth.canEditBranchContent ? { ok: true } : { ok: false, reason: 'Editing is disabled. You need branches.write.' };
        case 'template-write':
            return auth.canWriteTemplates ? { ok: true } : { ok: false, reason: 'Template editing requires templates.write.' };
        case 'branch-create':
            return auth.canCreateBranch ? { ok: true } : { ok: false, reason: 'Branch creation requires branches.create.' };
        case 'branch-merge':
            return auth.canMergeBranches ? { ok: true } : { ok: false, reason: 'Branch merge requires branches.merge.' };
        case 'branch-publish':
            return auth.canPublishBranches ? { ok: true } : { ok: false, reason: 'Branch publish requires branches.publish.' };
        case 'branch-delete':
            return auth.canDeleteBranches ? { ok: true } : { ok: false, reason: 'Branch deletion requires branches.delete.' };
        case 'branch-manage':
            return auth.canManageBranches ? { ok: true } : { ok: false, reason: 'Branch management requires branches.manage.' };
        case 'comment-read':
            return auth.canCommentRead ? { ok: true } : { ok: false, reason: 'Comment read access is disabled for this actor.' };
        case 'comment-write':
            return auth.canCommentWrite ? { ok: true } : { ok: false, reason: 'Comment write access is disabled for this actor.' };
        default:
            return { ok: false, reason: 'Action is not authorized.' };
    }
}
