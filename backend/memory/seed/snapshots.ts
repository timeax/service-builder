import type { Commit, Draft, ServiceSnapshot } from '@timeax/digital-service-engine/workspace';
import type { EditorSnapshot } from '@timeax/digital-service-engine/schema';
import { isoNow } from '../utils';

const makeEditorSnapshot = (): EditorSnapshot => {
    const tagId = 'tag:platform';
    const fieldId = 'field:service';
    const optIg = 'opt:ig';
    const optYt = 'opt:yt';

    return {
        props: {
            filters: [{ id: tagId, label: 'Platform', bind_id: 'platform', constraints: { visible: true } }],
            fields: [
                {
                    id: fieldId,
                    label: 'Service',
                    type: 'select',
                    bind_id: 'service_id',
                    options: [
                        { id: optIg, label: 'Instagram Followers • Fast', value: 1001, service_id: 1001 },
                        { id: optYt, label: 'YouTube Views • Steady', value: 1003, service_id: 1003 },
                    ],
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
                        { id: optYt, kind: 'option', label: 'YT Views' },
                    ],
                    edges: [
                        { from: tagId, to: fieldId, kind: 'bind' },
                        { from: fieldId, to: optIg, kind: 'child' },
                        { from: fieldId, to: optYt, kind: 'child' },
                    ],
                },
                positions: {
                    [tagId]: { x: 120, y: 140 },
                    [fieldId]: { x: 420, y: 140 },
                    [optIg]: { x: 720, y: 80 },
                    [optYt]: { x: 720, y: 200 },
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
    createdAt: isoNow(),
};

const draftMain: Draft = {
    id: 'draft:main:1',
    branchId: 'branch:main',
    status: 'uncommitted',
    etag: 'etag:draft:main:1',
    meta: { note: 'Local uncommitted draft' },
    createdAt: isoNow(),
    updatedAt: isoNow(),
};

export const snapshotsByBranch: Readonly<Record<string, { head?: Commit; draft?: Draft; snapshot: ServiceSnapshot }>> = {
    'branch:main': { head: headMain, draft: draftMain, snapshot: snapshotMain },
};
