import type { Author } from '@timeax/digital-service-engine/workspace';
import { isoDaysAgo, isoNow } from '../utils';

export const authors: readonly Author[] = [
    {
        id: 'author:davy',
        name: 'Davy',
        handle: 'timeax',
        avatarUrl: 'https://example.invalid/avatar.png',
        meta: { kind: 'human' },
        createdAt: isoDaysAgo(30),
        updatedAt: isoNow(),
    },
    {
        id: 'author:bot',
        name: 'Builder Bot',
        handle: 'builder-bot',
        meta: { kind: 'system' },
        createdAt: isoDaysAgo(7),
        updatedAt: isoNow(),
    },
];
