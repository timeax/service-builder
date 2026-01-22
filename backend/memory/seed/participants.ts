import type { BranchParticipant } from '@timeax/digital-service-engine/workspace';
import { isoNow } from '../utils';

export const participantsByBranch: Readonly<Record<string, readonly BranchParticipant[]>> = {
    'branch:main': [
        {
            id: 'part:main:davy',
            workspaceId: 'ws:local',
            branchId: 'branch:main',
            authorId: 'author:davy',
            roles: ['owner', 'editor'],
            canRead: true,
            canWrite: true,
            meta: { presence: 'online' },
            createdAt: isoNow(),
            updatedAt: isoNow(),
        },
        {
            id: 'part:main:bot',
            workspaceId: 'ws:local',
            branchId: 'branch:main',
            authorId: 'author:bot',
            roles: ['assistant'],
            canRead: true,
            canWrite: false,
            meta: { presence: 'idle' },
            createdAt: isoNow(),
            updatedAt: isoNow(),
        },
    ],
    'branch:experiment': [
        {
            id: 'part:exp:davy',
            workspaceId: 'ws:local',
            branchId: 'branch:experiment',
            authorId: 'author:davy',
            roles: ['editor'],
            canRead: true,
            canWrite: true,
            createdAt: isoNow(),
            updatedAt: isoNow(),
        },
    ],
};
