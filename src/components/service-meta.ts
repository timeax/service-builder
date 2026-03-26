export type ServiceMetaRow = {
    key: string;
    value: string;
};

function isPrimitive(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function flattenServiceMeta(meta: unknown): ServiceMetaRow[] {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return [];

    const rows: ServiceMetaRow[] = [];

    const visit = (value: unknown, path: string) => {
        if (isPrimitive(value)) {
            const key = path.replace(/^meta\./, '');
            rows.push({ key, value: String(value) });
            return;
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;

        for (const [childKey, childValue] of Object.entries(value)) {
            visit(childValue, `${path}.${childKey}`);
        }
    };

    for (const [key, value] of Object.entries(meta)) {
        visit(value, `meta.${key}`);
    }

    return rows;
}

