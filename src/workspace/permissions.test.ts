import { describe, expect, it } from 'vitest';
import {
    BUILDER_PERMISSIONS,
    can,
    canCreateBranch,
    canEditBranch,
    canManageParticipants,
    canManagePolicies,
    canManageTemplates,
    canMergeBranch,
    canPublishBranch,
    canReadBranches,
    canReadServices,
    canReadWorkspace,
    canWriteWorkspace,
    toBuilderPermissionsMap,
    type BuilderPermissionsMap,
} from './permissions.ts';

describe('builder permissions helpers', () => {
    it('denies by default when key is missing', () => {
        const map: BuilderPermissionsMap = {};

        expect(can(map, BUILDER_PERMISSIONS.WORKSPACE_READ)).toBe(false);
        expect(canEditBranch(map)).toBe(false);
    });

    it('returns true when permission keys are present', () => {
        const map: BuilderPermissionsMap = {
            'workspace.read': true,
            'workspace.write': true,
            'branches.read': true,
            'branches.create': true,
            'branches.write': true,
            'branches.merge': true,
            'branches.publish': true,
            'templates.manage': true,
            'policies.manage': true,
            'participants.manage': true,
            'services.read': true,
        };

        expect(canReadWorkspace(map)).toBe(true);
        expect(canWriteWorkspace(map)).toBe(true);
        expect(canReadBranches(map)).toBe(true);
        expect(canCreateBranch(map)).toBe(true);
        expect(canEditBranch(map)).toBe(true);
        expect(canMergeBranch(map)).toBe(true);
        expect(canPublishBranch(map)).toBe(true);
        expect(canManageTemplates(map)).toBe(true);
        expect(canManagePolicies(map)).toBe(true);
        expect(canManageParticipants(map)).toBe(true);
        expect(canReadServices(map)).toBe(true);
    });

    it('filters unknown keys when adapting engine permissions maps', () => {
        const map = toBuilderPermissionsMap({
            'workspace.read': true,
            'branches.write': true,
            'unknown.permission': true,
        } as any);

        expect(map['workspace.read']).toBe(true);
        expect(map['branches.write']).toBe(true);
        expect((map as Record<string, boolean>)['unknown.permission']).toBeUndefined();
    });
});
