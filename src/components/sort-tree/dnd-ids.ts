import type { NodePath } from "./types";
import { pathToString, stringToPath } from "./utils";

export type Zone = "before" | "on" | "after";

export function zoneId(path: NodePath, zone: Zone): string {
    return `dz:${zone}:${pathToString(path)}`;
}
export function parseZoneId(id: string): { zone: Zone; path: NodePath } | null {
    if (!id.startsWith("dz:")) return null;
    const [, zone, raw] = id.split(":");
    if (zone !== "before" && zone !== "on" && zone !== "after") return null;
    return { zone: zone as Zone, path: stringToPath(raw ?? "") };
}
export function dragId(path: NodePath): string {
    return `node:${pathToString(path)}`;
}
export function parseDragId(id: string): NodePath | null {
    if (!id.startsWith("node:")) return null;
    return stringToPath(id.slice(5));
}