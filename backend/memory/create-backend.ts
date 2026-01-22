import { createMemoryWorkspaceBackend } from '@timeax/digital-service-engine/workspace';

import { seed } from './seed';
import { workspaceActor } from './seed/meta';

export const workspaceBackend = createMemoryWorkspaceBackend({
    workspaceId: 'ws:local',
    actorId: workspaceActor.id,
    ensureMain: true,
    ensureActorAuthor: true,
    seed,
});
