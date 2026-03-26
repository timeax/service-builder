import type { PermissionsMap } from '@timeax/digital-service-engine/workspace';

export const BUILDER_PERMISSIONS = {
    WORKSPACE_READ: 'workspace.read',
    WORKSPACE_WRITE: 'workspace.write',
    BRANCHES_READ: 'branches.read',
    BRANCHES_CREATE: 'branches.create',
    BRANCHES_WRITE: 'branches.write',
    BRANCHES_DELETE: 'branches.delete',
    BRANCHES_MERGE: 'branches.merge',
    BRANCHES_PUBLISH: 'branches.publish',
    BRANCHES_MANAGE: 'branches.manage',
    TEMPLATES_READ: 'templates.read',
    TEMPLATES_WRITE: 'templates.write',
    TEMPLATES_DELETE: 'templates.delete',
    TEMPLATES_MANAGE: 'templates.manage',
    COMMENTS_READ: 'comments.read',
    COMMENTS_WRITE: 'comments.write',
    COMMENTS_MODERATE: 'comments.moderate',
    POLICIES_READ: 'policies.read',
    POLICIES_WRITE: 'policies.write',
    POLICIES_MANAGE: 'policies.manage',
    PARTICIPANTS_READ: 'participants.read',
    PARTICIPANTS_WRITE: 'participants.write',
    PARTICIPANTS_MANAGE: 'participants.manage',
    SERVICES_READ: 'services.read',
} as const;

export type BuilderPermission = (typeof BUILDER_PERMISSIONS)[keyof typeof BUILDER_PERMISSIONS];
export type BuilderPermissionsMap = Readonly<Partial<Record<BuilderPermission, boolean>>>;
export type BuilderActorId = `actor:${string}`;

const BUILDER_PERMISSION_KEYS = new Set<BuilderPermission>(Object.values(BUILDER_PERMISSIONS));

export function toBuilderPermissionsMap(permissions?: PermissionsMap | null): BuilderPermissionsMap {
    if (!permissions) return {};

    const result: Partial<Record<BuilderPermission, boolean>> = {};
    for (const [key, value] of Object.entries(permissions)) {
        if (!BUILDER_PERMISSION_KEYS.has(key as BuilderPermission)) continue;
        result[key as BuilderPermission] = value === true;
    }

    return result;
}

export function can(map: BuilderPermissionsMap | null | undefined, permission: BuilderPermission): boolean {
    if (!map) return false;
    return map[permission] === true;
}

export function canReadWorkspace(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.WORKSPACE_READ);
}

export function canWriteWorkspace(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.WORKSPACE_WRITE);
}

export function canReadBranches(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_READ);
}

export function canEditBranch(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_WRITE);
}

export function canCreateBranch(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_CREATE);
}

export function canMergeBranch(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_MERGE);
}

export function canPublishBranch(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_PUBLISH);
}

export function canDeleteBranch(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_DELETE);
}

export function canManageBranches(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.BRANCHES_MANAGE);
}

export function canWriteTemplates(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.TEMPLATES_WRITE);
}

export function canManageTemplates(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.TEMPLATES_MANAGE);
}

export function canReadComments(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.COMMENTS_READ);
}

export function canWriteComments(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.COMMENTS_WRITE);
}

export function canManagePolicies(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.POLICIES_MANAGE);
}

export function canWritePolicies(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.POLICIES_WRITE);
}

export function canManageParticipants(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.PARTICIPANTS_MANAGE);
}

export function canWriteParticipants(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.PARTICIPANTS_WRITE);
}

export function canManagePoliciesOrWrite(map: BuilderPermissionsMap | null | undefined): boolean {
    return canManagePolicies(map) || canWritePolicies(map);
}

export function canManageParticipantsOrWrite(map: BuilderPermissionsMap | null | undefined): boolean {
    return canManageParticipants(map) || canWriteParticipants(map);
}

export function canReadServices(map: BuilderPermissionsMap | null | undefined): boolean {
    return can(map, BUILDER_PERMISSIONS.SERVICES_READ);
}
