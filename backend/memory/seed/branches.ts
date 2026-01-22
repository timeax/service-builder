import type { Branch } from '@timeax/digital-service-engine/workspace';
import { isoNow } from '../utils';

export const mainId = 'branch:main';

export const branches: readonly Branch[] = [
    {
        id: mainId,
        name: 'main',
        isMain: true,
        headVersionId: 'v1',
        createdAt: isoNow(),
        updatedAt: isoNow(),
    },
    {
        id: 'branch:experiment',
        name: 'experiment',
        isMain: false,
        headVersionId: 'v2',
        createdAt: isoNow(),
        updatedAt: isoNow(),
    },
];
