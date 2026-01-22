import type { WorkspaceProviderProps } from '@timeax/digital-service-engine/workspace';

import { authors } from './seed/authors';
import { branches, mainId } from './seed/branches';
import { commentsByBranch } from './seed/comments';
import { participantsByBranch } from './seed/participants';
import { permissions } from './seed/permissions';
import { policies } from './seed/policies';
import { services } from './seed/services';
import { snapshotsByBranch } from './seed/snapshots';
import { templates } from './seed/templates';

export const workspaceInitial: WorkspaceProviderProps['initial'] = {
    authors,
    permissions,
    branches,
    mainId,

    currentBranchId: mainId,

    templates,
    participants: participantsByBranch[mainId] ?? [],

    snapshot: snapshotsByBranch[mainId]?.snapshot,
    head: snapshotsByBranch[mainId]?.head,
    draft: snapshotsByBranch[mainId]?.draft,

    services,
    policies,
    comments: commentsByBranch[mainId] ?? [],
};
