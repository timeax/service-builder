import type { Actor, BranchParticipant, PermissionsMap } from '@timeax/digital-service-engine/workspace';
import { describe, expect, it } from 'vitest';
import { deriveWorkspaceAuthorization, getAuthorizationDecision } from './authorization.ts';

const actor: Actor = {
    id: 'actor:davy',
    name: 'Davy',
    meta: {
        authorId: 'author:davy',
    },
};

function makeParticipant(canWrite: boolean): BranchParticipant {
    return {
        id: 'part:main:davy',
        workspaceId: 'ws:local',
        branchId: 'branch:main',
        authorId: 'author:davy',
        roles: ['editor'],
        canRead: true,
        canWrite,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T00:00:00.000Z',
    };
}

describe('deriveWorkspaceAuthorization', () => {
    it('allows full editing for an editor with matching permissions and participant write access', () => {
        const permissions: PermissionsMap = {
            'workspace.read': true,
            'workspace.write': true,
            'branches.create': true,
            'branches.merge': true,
            'templates.write': true,
            'comments.read': true,
            'comments.write': true,
        };

        const auth = deriveWorkspaceAuthorization({
            actor,
            permissions,
            participants: [makeParticipant(true)],
        });

        expect(auth.canReadWorkspace).toBe(true);
        expect(auth.canEditBranchContent).toBe(true);
        expect(auth.canWriteTemplates).toBe(true);
        expect(auth.canCreateBranch).toBe(true);
        expect(auth.canMergeBranches).toBe(true);
        expect(auth.canCommentWrite).toBe(true);
        expect(getAuthorizationDecision(auth, 'branch-content-edit').ok).toBe(true);
    });

    it('blocks branch edits for read-only users while still allowing comment writes when permitted', () => {
        const permissions: PermissionsMap = {
            'workspace.read': true,
            'workspace.write': false,
            'templates.write': false,
            'comments.read': true,
            'comments.write': true,
        };

        const auth = deriveWorkspaceAuthorization({
            actor,
            permissions,
            participants: [makeParticipant(false)],
        });

        expect(auth.canEditBranchContent).toBe(false);
        expect(auth.canWriteTemplates).toBe(false);
        expect(auth.canCommentRead).toBe(true);
        expect(auth.canCommentWrite).toBe(true);
        expect(getAuthorizationDecision(auth, 'branch-content-edit').ok).toBe(false);
        expect(getAuthorizationDecision(auth, 'comment-write').ok).toBe(true);
    });

    it('denies by default when permission keys are missing', () => {
        const auth = deriveWorkspaceAuthorization({
            actor,
            permissions: {},
            participants: [makeParticipant(true)],
        });

        expect(auth.canReadWorkspace).toBe(false);
        expect(auth.canEditBranchContent).toBe(false);
        expect(auth.canCommentRead).toBe(false);
        expect(auth.canCommentWrite).toBe(false);
        expect(getAuthorizationDecision(auth, 'comment-write').ok).toBe(false);
    });
});
