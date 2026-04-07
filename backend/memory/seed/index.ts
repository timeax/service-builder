import { authors } from './authors';
import { branches } from './branches';
import { commentsByBranch } from './comments';
import { workspaceInfo } from './meta';
import { participantsByBranch } from './participants';
import { permissions } from './permissions';
import { policies, policiesByBranch } from './policies';
import { snapshotsByBranch } from './snapshots';
import { templates } from './templates';
import { getServices } from './services-2.ts';

export const seed = {
    info: workspaceInfo,

    // optional, but nice to keep in seed for debug tools
    authors,
    permissions,
    branches,
    participants: participantsByBranch,

    services: getServices(),
    templates,

    snapshots: snapshotsByBranch,

    comments: commentsByBranch,

    policies,
    policiesByBranch,
} as const;
