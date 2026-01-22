import type { CommentThread } from '@timeax/digital-service-engine/schema';

const now = Date.now();
const minutes = (n: number) => n * 60 * 1000;
const hours = (n: number) => n * 60 * 60 * 1000;

export const commentsByBranch: Readonly<Record<string, readonly CommentThread[]>> = {
    'branch:main': [
        // --- existing
        {
            id: 'thread:welcome',
            anchor: { type: 'free', position: { x: 420, y: 180 } },
            resolved: false,
            createdAt: now - minutes(10),
            updatedAt: now - minutes(2),
            messages: [
                {
                    id: 'msg:1',
                    authorId: 'author:bot',
                    isMain: true,
                    authorName: 'Builder Bot',
                    body: 'Seeded memory backend: branches, templates, services, snapshot, and policies.',
                    createdAt: now - minutes(10),
                },
            ],
            meta: { priority: 'low' },
            _sync: 'synced',
        },

        // --- new: canvas notes
        {
            id: 'thread:canvas-notes',
            anchor: { type: 'free', position: { x: 740, y: 120 } },
            resolved: false,
            createdAt: now - minutes(45),
            updatedAt: now - minutes(5),
            messages: [
                {
                    id: 'msg:canvas:1',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'We need hover handles during add-edge mode (temporary handles).',
                    createdAt: now - minutes(45),
                },
                {
                    id: 'msg:canvas:2',
                    authorId: 'author:bot',
                    isMain: false,
                    authorName: 'Builder Bot',
                    body: 'Noted. We can generate ephemeral handles on hover and finalize on connect.',
                    createdAt: now - minutes(37),
                },
                {
                    id: 'msg:canvas:3',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Also: edge hover resize should stay consistent with Panel behaviour.',
                    createdAt: now - minutes(5),
                },
            ],
            meta: { priority: 'med', tags: ['canvas', 'ux'] },
            _sync: 'synced',
        },

        // --- new: templates feedback
        {
            id: 'thread:templates-feedback',
            anchor: { type: 'free', position: { x: 260, y: 420 } },
            resolved: false,
            createdAt: now - hours(3),
            updatedAt: now - minutes(18),
            messages: [
                {
                    id: 'msg:tpl:1',
                    authorId: 'author:bot',
                    isMain: false,
                    authorName: 'Builder Bot',
                    body: 'Template seed includes url + quantity + promo (experiment). Want more variants (json-editor, select-tree)?',
                    createdAt: now - hours(3),
                },
                {
                    id: 'msg:tpl:2',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Yes. Add json-editor template later, but keep default seed light for now.',
                    createdAt: now - hours(2) - minutes(40),
                },
                {
                    id: 'msg:tpl:3',
                    authorId: 'author:bot',
                    isMain: false,
                    authorName: 'Builder Bot',
                    body: 'Ok — we’ll add it behind a flag or branch seed so main stays simple.',
                    createdAt: now - minutes(18),
                },
            ],
            meta: { priority: 'low', tags: ['templates'] },
            _sync: 'synced',
        },

        // --- new: policy warning discussion
        {
            id: 'thread:policy-warning',
            anchor: { type: 'free', position: { x: 560, y: 520 } },
            resolved: true,
            createdAt: now - hours(8),
            updatedAt: now - hours(6),
            messages: [
                {
                    id: 'msg:pol:1',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Policy warnings should show up as non-blocking banners, not toasts.',
                    createdAt: now - hours(8),
                },
                {
                    id: 'msg:pol:2',
                    authorId: 'author:bot',
                    isMain: false,
                    authorName: 'Builder Bot',
                    body: 'Agreed. Toasts are noisy; banners + inline markers are cleaner.',
                    createdAt: now - hours(7) - minutes(40),
                },
                {
                    id: 'msg:pol:3',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Resolved — we’ll do banner + per-field hints.',
                    createdAt: now - hours(6),
                },
            ],
            meta: { priority: 'low', tags: ['policies', 'ui'], resolvedBy: 'author:davy' },
            _sync: 'synced',
        },

        // --- new: service selection / pricing
        {
            id: 'thread:service-selection',
            anchor: { type: 'free', position: { x: 980, y: 340 } },
            resolved: false,
            createdAt: now - hours(1) - minutes(12),
            updatedAt: now - minutes(9),
            messages: [
                {
                    id: 'msg:srv:1',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Service map should be searchable by category + flags (refill/geo/instant).',
                    createdAt: now - hours(1) - minutes(12),
                },
                {
                    id: 'msg:srv:2',
                    authorId: 'author:bot',
                    isMain: false,
                    authorName: 'Builder Bot',
                    body: 'We can index by (category, flagset) and add quick filters in Left panel.',
                    createdAt: now - hours(1),
                },
                {
                    id: 'msg:srv:3',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Also ensure the selected service previews estimates (start/speed/average).',
                    createdAt: now - minutes(9),
                },
            ],
            meta: { priority: 'high', tags: ['services', 'filters', 'estimates'] },
            _sync: 'synced',
        },
    ],

    // Optional: add a few threads in experiment too (helps branch switching tests)
    'branch:experiment': [
        {
            id: 'thread:exp:promo',
            anchor: { type: 'free', position: { x: 300, y: 140 } },
            resolved: false,
            createdAt: now - minutes(22),
            updatedAt: now - minutes(4),
            messages: [
                {
                    id: 'msg:exp:1',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'Experiment branch: promo_code template should be visible only here.',
                    createdAt: now - minutes(22),
                },
                {
                    id: 'msg:exp:2',
                    authorId: 'author:bot',
                    isMain: false,
                    authorName: 'Builder Bot',
                    body: 'Ok. We’ll keep it branch-scoped and ensure initial hydration swaps templates correctly.',
                    createdAt: now - minutes(14),
                },
                {
                    id: 'msg:exp:3',
                    authorId: 'author:davy',
                    isMain: true,
                    authorName: 'Davy',
                    body: 'If branch cache is enabled, avoid re-fetching templates on fast switches.',
                    createdAt: now - minutes(4),
                },
            ],
            meta: { priority: 'med', tags: ['branch', 'templates'] },
            _sync: 'synced',
        },
    ],
};
