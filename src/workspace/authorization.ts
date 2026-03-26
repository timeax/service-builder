import type { Actor, Author, BranchParticipant, PermissionsMap } from '@timeax/digital-service-engine/workspace';

export type WorkspaceAuthorization = {
    authorId: string;
    participant: BranchParticipant | null;
    canReadWorkspace: boolean;
    canEditBranchContent: boolean;
    canCreateBranch: boolean;
    canMergeBranches: boolean;
    canManageBranches: boolean;
    canWriteTemplates: boolean;
    canCommentRead: boolean;
    canCommentWrite: boolean;
};

export type AuthorizationAction =
    | 'branch-content-edit'
    | 'snapshot-write'
    | 'template-write'
    | 'branch-create'
    | 'branch-merge'
    | 'branch-manage'
    | 'comment-read'
    | 'comment-write';

type DeriveWorkspaceAuthorizationArgs = {
    actor?: Actor | null;
    permissions?: PermissionsMap | null;
    participants?: readonly BranchParticipant[] | null;
    authors?: readonly Author[] | null;
};

export function hasPermission(permissions: PermissionsMap | null | undefined, key: string): boolean {
    if (!permissions) return false;
    return permissions[key] === true;
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

    const canReadWorkspace = hasPermission(permissions, 'workspace.read');
    const canEditBranchContent = hasPermission(permissions, 'workspace.write') && participant?.canWrite === true;
    const canCreateBranch = canEditBranchContent && hasPermission(permissions, 'branches.create');
    const canMergeBranches = canEditBranchContent && hasPermission(permissions, 'branches.merge');
    const canManageBranches = canCreateBranch || canMergeBranches || canEditBranchContent;
    const canWriteTemplates = canEditBranchContent && hasPermission(permissions, 'templates.write');
    const canCommentRead = canReadWorkspace && hasPermission(permissions, 'comments.read');
    const canCommentWrite = canReadWorkspace && hasPermission(permissions, 'comments.write');

    return {
        authorId,
        participant,
        canReadWorkspace,
        canEditBranchContent,
        canCreateBranch,
        canMergeBranches,
        canManageBranches,
        canWriteTemplates,
        canCommentRead,
        canCommentWrite,
    };
}

export function getAuthorizationDecision(auth: WorkspaceAuthorization, action: AuthorizationAction): { ok: boolean; reason?: string } {
    switch (action) {
        case 'branch-content-edit':
        case 'snapshot-write':
            return auth.canEditBranchContent
                ? { ok: true }
                : { ok: false, reason: 'Editing is disabled. You need workspace write access and branch write access.' };
        case 'template-write':
            return auth.canWriteTemplates ? { ok: true } : { ok: false, reason: 'Template editing requires templates.write and branch edit access.' };
        case 'branch-create':
            return auth.canCreateBranch ? { ok: true } : { ok: false, reason: 'Branch creation requires branches.create and branch edit access.' };
        case 'branch-merge':
            return auth.canMergeBranches ? { ok: true } : { ok: false, reason: 'Branch merge requires branches.merge and branch edit access.' };
        case 'branch-manage':
            return auth.canManageBranches ? { ok: true } : { ok: false, reason: 'Branch management requires branch edit access.' };
        case 'comment-read':
            return auth.canCommentRead ? { ok: true } : { ok: false, reason: 'Comment read access is disabled for this actor.' };
        case 'comment-write':
            return auth.canCommentWrite ? { ok: true } : { ok: false, reason: 'Comment write access is disabled for this actor.' };
        default:
            return { ok: false, reason: 'Action is not authorized.' };
    }
}
