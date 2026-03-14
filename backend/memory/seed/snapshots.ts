import type { EditorSnapshot } from '@timeax/digital-service-engine/schema';
import type { Commit, Draft, ServiceSnapshot } from '@timeax/digital-service-engine/workspace';
import { isoNow } from '../utils';

const makeEditorSnapshot = (): EditorSnapshot => {
    const platformTagId = 't:platform';

    const serviceFieldId = 'f:service';
    const urlFieldId = 'f:url';
    const qtyFieldId = 'f:qty';

    const optIg = 'o:ig';

    return {
        props: {
            filters: [
                {
                    id: platformTagId,
                    label: 'Platform',
                    // root tag => no parent
                    bind_id: undefined,
                    // UI-only stuff goes in meta (NOT constraints)
                    meta: { visible: true },
                },

                {
                    id: "t:platform-2",
                    label: 'Instagram',
                    // ✅ bind FIELD to TAG
                    bind_id: undefined,
                }
            ],

            fields: [
                {
                    id: serviceFieldId,
                    label: 'Service',
                    type: 'select',

                    // ✅ bind FIELD to TAG
                    bind_id: platformTagId,

                    options: [
                        {
                            id: optIg,
                            label: 'Instagram Followers • Fast',
                            value: 1001,
                            service_id: 1001,
                        },
                    ],
                    meta: { multi: false },
                },

                {
                    id: urlFieldId,
                    label: 'Target URL',
                    type: 'text',

                    // ✅ same: field is shown under platform context
                    bind_id: platformTagId,

                    // if you need a stable storage key separate from id:
                    name: 'link',
                },

                {
                    id: qtyFieldId,
                    label: 'Quantity',
                    type: 'number',

                    // ✅ same: field is shown under platform context
                    bind_id: platformTagId,

                    name: 'quantity',
                    meta: { quantity: { valueBy: 'value', clamp: { min: 1 } } },
                },
            ],

            schema_version: '1',
        },

        layout: {
            canvas: {
                graph: {
                    nodes: [
                        { id: platformTagId, kind: 'tag', label: 'Platform' },

                        { id: serviceFieldId, kind: 'field', label: 'Service', bind_type: 'bound' },
                        { id: urlFieldId, kind: 'field', label: 'Target URL', bind_type: 'bound' },
                        { id: qtyFieldId, kind: 'field', label: 'Quantity', bind_type: 'bound' },

                        { id: optIg, kind: 'option', label: 'IG Followers' },
                    ],
                    edges: [
                        // ✅ bind edges are from tag -> field
                        { from: platformTagId, to: serviceFieldId, kind: 'bind' },
                        { from: platformTagId, to: urlFieldId, kind: 'bind' },
                        { from: platformTagId, to: qtyFieldId, kind: 'bind' },

                        // ✅ option is a child of the service field
                        { from: serviceFieldId, to: optIg, kind: 'child' },
                    ],
                },

                positions: {
                    [platformTagId]: { x: 120, y: 140 },

                    [serviceFieldId]: { x: 420, y: 80 },
                    [urlFieldId]: { x: 420, y: 170 },
                    [qtyFieldId]: { x: 420, y: 260 },

                    [optIg]: { x: 720, y: 80 },
                },

                selection: new Set<string>([serviceFieldId]),
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
