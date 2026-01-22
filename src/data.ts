import {
    createMemoryWorkspaceBackend,
    type Actor,
    // backend types (barrel re-exported)
    type Author,
    type Branch,
    type BranchParticipant,
    type Commit,
    type Draft,
    type FieldTemplate,
    type PermissionsMap,
    type ServiceSnapshot,
    type WorkspaceProviderProps,
} from '@timeax/digital-service-engine/react';

import type { CommentThread, DgpServiceMap, DynamicRule, EditorSnapshot } from '@timeax/digital-service-engine/schema';

// -----------------------------------------------------------------------------
// Identity
// -----------------------------------------------------------------------------
export const workspaceActor: Actor = {
    id: 'actor:davy',
    name: 'Davy',
    roles: ['owner', 'editor', 'admin'],
    meta: { env: 'memory-test' },
};

// -----------------------------------------------------------------------------
// Authors
// -----------------------------------------------------------------------------
const authors: readonly Author[] = [
    {
        id: 'author:davy',
        name: 'Davy',
        handle: 'timeax',
        avatarUrl: 'https://example.invalid/avatar.png',
        meta: { kind: 'human' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'author:bot',
        name: 'Builder Bot',
        handle: 'builder-bot',
        meta: { kind: 'system' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

// -----------------------------------------------------------------------------
// Permissions
// -----------------------------------------------------------------------------
const permissions: PermissionsMap = {
    'workspace.read': true,
    'workspace.write': true,
    'branches.create': true,
    'branches.merge': true,
    'templates.read': true,
    'templates.write': true,
    'comments.read': true,
    'comments.write': true,
    'policies.read': true,
    'policies.write': true,
    'services.read': true,
};

// -----------------------------------------------------------------------------
// Branches
// -----------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();

const branches: readonly Branch[] = [
    {
        id: 'branch:main',
        name: 'main',
        isMain: true,
        headVersionId: 'v1',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
    {
        id: 'branch:experiment',
        name: 'experiment',
        isMain: false,
        headVersionId: 'v2',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
];

// -----------------------------------------------------------------------------
// Participants
// -----------------------------------------------------------------------------
const participantsByBranch: Readonly<Record<string, readonly BranchParticipant[]>> = {
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
            createdAt: nowIso(),
            updatedAt: nowIso(),
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
            createdAt: nowIso(),
            updatedAt: nowIso(),
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
            createdAt: nowIso(),
            updatedAt: nowIso(),
        },
    ],
};

// -----------------------------------------------------------------------------
// Services (use “as much data as possible”)
// -----------------------------------------------------------------------------
const services: DgpServiceMap = {
    1001: {
        id: 1001,
        name: 'Instagram Followers • Fast',
        rate: 1.25,
        min: 50,
        max: 50000,
        category: 'instagram/followers',
        flags: {
            refill: { enabled: true, description: 'Refill available (30 days)' },
            dripfeed: { enabled: true, description: 'Drip-feed supported' },
        },
        estimates: {
            start: { min_seconds: 60, max_seconds: 600, label: '1–10 mins' },
            speed: { amount: 2000, per: 'day', unit: 'followers', label: '2k/day' },
            average: { min_seconds: 86400, max_seconds: 259200, label: '1–3 days' },
        },
        meta: { provider: 'demo', key: 'ig_follow_fast' },
    },
    1002: {
        id: 1002,
        name: 'TikTok Likes • Instant',
        rate: 0.75,
        min: 10,
        max: 100000,
        category: 'tiktok/likes',
        flags: {
            refill: { enabled: false, description: 'No refill for likes' },
            guaranteed: { enabled: true, description: 'Guaranteed delivery' },
        },
        estimates: {
            start: { min_seconds: 5, max_seconds: 45, label: 'instant' },
            speed: { amount: 10000, per: 'hour', unit: 'likes', label: '10k/hr' },
            average: { min_seconds: 3600, max_seconds: 21600, label: '1–6 hours' },
        },
        meta: { provider: 'demo', key: 'tt_likes_instant' },
    },
};

// -----------------------------------------------------------------------------
// Templates
// -----------------------------------------------------------------------------
const templates: readonly FieldTemplate[] = [
    {
        id: 'tpl:url',
        key: 'url',
        name: 'Target URL',
        kind: 'text',
        definition: { variant: 'text', props: { placeholder: 'https://...', mode: 'url' } },
        defaults: { value: '' },
        ui: { icon: 'link', width: 'full' },
        tags: ['core', 'input'],
        published: true,
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
    {
        id: 'tpl:quantity',
        key: 'quantity',
        name: 'Quantity',
        kind: 'number',
        definition: { variant: 'number', props: { min: 1, step: 1 } },
        defaults: { value: 100 },
        ui: { icon: 'hash', width: 'half' },
        tags: ['core', 'pricing'],
        published: true,
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
];

// -----------------------------------------------------------------------------
// Policies
// -----------------------------------------------------------------------------
const policies: readonly DynamicRule[] = [
    {
        id: 'rule:no-mix-instagram-youtube',
        label: 'Do not mix Instagram + YouTube services',
        scope: 'global',
        subject: 'services',
        filter: {
            role: 'both',
            where: [
                { path: 'service.category', op: 'sw', value: 'instagram/' },
                { path: 'service.category', op: 'sw', value: 'youtube/' },
            ],
        },
        op: 'no_mix',
        severity: 'warning',
        message: 'Avoid mixing Instagram and YouTube in the same configuration.',
    },
];

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------
const commentsByBranch: Readonly<Record<string, readonly CommentThread[]>> = {
    'branch:main': [
        {
            id: 'thread:welcome',
            anchor: { type: 'free', position: { x: 420, y: 180 } },
            resolved: false,
            createdAt: Date.now() - 1000 * 60 * 10,
            updatedAt: Date.now() - 1000 * 60 * 2,
            messages: [
                {
                    id: 'msg:1',
                    authorId: 'author:bot',
                    authorName: 'Builder Bot',
                    isMain: true,
                    body: 'Seeded memory backend: branches, templates, services, snapshot, and policies.',
                    createdAt: Date.now() - 1000 * 60 * 10,
                },
            ],
            meta: { priority: 'low' },
            _sync: 'synced',
        },
    ],
};

// -----------------------------------------------------------------------------
// Snapshot
// -----------------------------------------------------------------------------
const makeEditorSnapshot = (): EditorSnapshot => {
    const tagId = 'tag:platform';
    const fieldId = 'field:service';
    const optIg = 'opt:ig';

    return {
        props: {
            filters: [{ id: tagId, label: 'Platform', bind_id: 'platform', constraints: { visible: true } }],
            fields: [
                {
                    id: fieldId,
                    label: 'Service',
                    type: 'select',
                    bind_id: 'service_id',
                    options: [{ id: optIg, label: 'Instagram Followers • Fast', value: 1001, service_id: 1001 }],
                    meta: { multi: false },
                },
                { id: 'field:url', label: 'Target URL', type: 'text', bind_id: 'link' },
                {
                    id: 'field:qty',
                    label: 'Quantity',
                    type: 'number',
                    bind_id: 'quantity',
                    meta: { quantity: { valueBy: 'value', clamp: { min: 1 } } },
                },
            ],
            schema_version: '1',
        },
        layout: {
            canvas: {
                graph: {
                    nodes: [
                        { id: tagId, kind: 'tag', label: 'Platform' },
                        { id: fieldId, kind: 'field', label: 'Service' },
                        { id: optIg, kind: 'option', label: 'IG Followers' },
                    ],
                    edges: [
                        { from: tagId, to: fieldId, kind: 'bind' },
                        { from: fieldId, to: optIg, kind: 'child' },
                    ],
                },
                positions: {
                    [tagId]: { x: 120, y: 140 },
                    [fieldId]: { x: 420, y: 140 },
                    [optIg]: { x: 720, y: 140 },
                },
                selection: new Set<string>([fieldId]),
                highlighted: new Set<string>([optIg]),
                viewport: { x: 0, y: 0, zoom: 1 },
                version: 1,
            },
        },
        meta: { seeded: true },
    };
};

const snapshotMain: ServiceSnapshot = {
    schema_version: '1',
    data: makeEditorSnapshot(),
    meta: { branch: 'main' },
};

const headMain: Commit = {
    id: 'commit:main:1',
    branchId: 'branch:main',
    message: 'Initial seed commit',
    versionId: 'v1',
    createdAt: nowIso(),
};

const draftMain: Draft = {
    id: 'draft:main:1',
    branchId: 'branch:main',
    status: 'uncommitted',
    etag: 'etag:draft:main:1',
    meta: { note: 'Local uncommitted draft' },
    createdAt: nowIso(),
    updatedAt: nowIso(),
};

// -----------------------------------------------------------------------------
// Backend
// -----------------------------------------------------------------------------
export const workspaceBackend = createMemoryWorkspaceBackend({
    workspaceId: 'ws:local',
    actorId: workspaceActor.id,
    ensureMain: true,
    ensureActorAuthor: true,
    seed: {
        info: {
            id: 'ws:local',
            name: 'Local Workspace (Memory)',
            description: 'Seeded in-memory backend for UI testing',
            meta: { env: 'dev', transport: 'memory' },
        },
        actor: {
            id: workspaceActor.id,
            name: workspaceActor.name,
            roles: workspaceActor.roles,
            meta: workspaceActor.meta,
        },
        authors,
        permissions,
        branches,
        participants: participantsByBranch,
        services,
        templates,
        snapshots: {
            'branch:main': { head: headMain, draft: draftMain, snapshot: snapshotMain },
        },
        comments: commentsByBranch,
        policies,
    },
});

// -----------------------------------------------------------------------------
// Initial hydration
// -----------------------------------------------------------------------------
export const workspaceInitial: WorkspaceProviderProps['initial'] = {
    authors,
    permissions,
    branches,
    mainId: 'branch:main',

    templates,
    participants: participantsByBranch['branch:main'] ?? [],

    snapshot: snapshotMain,
    head: headMain,
    draft: draftMain,

    currentBranchId: 'branch:main',

    services,
    policies,
    comments: commentsByBranch['branch:main'] ?? [],
};
