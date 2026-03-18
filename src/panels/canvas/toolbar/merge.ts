import type { ResolvedTools, ToolDescriptor, ToolsConfig } from './types.ts';

export function resolveTools(config: ToolsConfig): ResolvedTools {
    const base = dedupeById(config.base ?? []);
    const extended = dedupeById(config.extend ?? []);
    const hidden = new Set(config.hidden ?? []);

    const byId = new Map<string, ToolDescriptor>();
    for (const tool of base) byId.set(tool.id, tool);
    for (const tool of extended) byId.set(tool.id, tool);

    let arr = Array.from(byId.values()).filter((tool) => !hidden.has(tool.id));
    arr = sortWithAnchors(arr);
    arr.sort((a, b) => {
        const ga = a.group ?? 'view';
        const gb = b.group ?? 'view';
        if (ga !== gb) return ga < gb ? -1 : 1;
        const oa = a.order ?? 0;
        const ob = b.order ?? 0;
        return oa - ob;
    });

    return arr;
}

function dedupeById(list: ToolDescriptor[]): ToolDescriptor[] {
    const seen = new Set<string>();
    const out: ToolDescriptor[] = [];
    for (const tool of list) {
        if (seen.has(tool.id)) continue;
        seen.add(tool.id);
        out.push(tool);
    }
    return out;
}

function sortWithAnchors(list: ToolDescriptor[]): ToolDescriptor[] {
    const byId = new Map(list.map((item) => [item.id, item]));
    const out: ToolDescriptor[] = [];
    const placed = new Set<string>();

    const place = (tool: ToolDescriptor) => {
        if (placed.has(tool.id)) return;
        if (tool.insertBefore && byId.has(tool.insertBefore)) {
            const anchor = byId.get(tool.insertBefore)!;
            place(anchor);
            const idx = out.findIndex((item) => item.id === anchor.id);
            out.splice(idx, 0, tool);
            placed.add(tool.id);
            return;
        }
        if (tool.insertAfter && byId.has(tool.insertAfter)) {
            place(byId.get(tool.insertAfter)!);
            const idx = out.findIndex((item) => item.id === tool.insertAfter);
            out.splice(idx + 1, 0, tool);
            placed.add(tool.id);
            return;
        }
        out.push(tool);
        placed.add(tool.id);
    };

    for (const tool of list) place(tool);
    return out;
}

