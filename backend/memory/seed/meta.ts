import type { Actor } from '@timeax/digital-service-engine/workspace';

export const workspaceActor: Actor = {
    id: 'actor:davy',
    name: 'Davy',
    roles: ['owner', 'editor', 'admin'],
    meta: { env: 'memory-test' },
};

export const workspaceInfo = {
    id: 'ws:local',
    name: 'Local Workspace (Memory)',
    description: 'Seeded in-memory backend for UI testing',
    meta: { env: 'dev', transport: 'memory' },
};
