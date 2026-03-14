import type { NodePath } from './types';
import { pathToString, stringToPath } from './utils';

export type DropZone = 'before' | 'on' | 'after';

const DZ = 'dz|'; // dropzone id prefix
const DR = 'dr|'; // draggable id prefix

/** Compose a draggable id from a path */
export function dragId(path: NodePath): string {
    return DR + pathToString(path);
}

/** Parse a draggable id to its path (or null) */
export function parseDragId(id: string): NodePath | null {
    if (!id || !id.startsWith(DR)) return null;
    const rest = id.slice(DR.length);
    try {
        return stringToPath(rest);
    } catch {
        return null;
    }
}

/** Compose a drop-zone id from a path + zone */
export function zoneId(path: NodePath, zone: DropZone): string {
    return `${DZ}${zone}|${pathToString(path)}`;
}

/** Parse a drop-zone id back to { zone, path } */
export function parseZoneId(id: string): { zone: DropZone; path: NodePath } | null {
    if (!id || !id.startsWith(DZ)) return null;
    // split only on the first two pipes: "dz|<zone>|<pathString>"
    const first = id.indexOf('|'); // after "dz"
    const second = id.indexOf('|', first + 1); // between zone and path
    if (first === -1 || second === -1) return null;

    const zoneStr = id.slice(first + 1, second);
    if (zoneStr !== 'before' && zoneStr !== 'on' && zoneStr !== 'after') return null;

    const rest = id.slice(second + 1);
    try {
        const path = stringToPath(rest);
        return { zone: zoneStr as DropZone, path };
    } catch {
        return null;
    }
}
