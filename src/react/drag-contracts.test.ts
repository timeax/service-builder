// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { acceptsCanonicalCanvasDrop, DRAG_MIME_ASSET_BUILTIN, DRAG_MIME_ASSET_TEMPLATE, readCanonicalAssetDrag } from './drag-contracts';

function transfer(values: Record<string, string>) {
    return {
        types: Object.keys(values),
        getData(type: string) { return values[type] ?? ''; },
    } as unknown as DataTransfer;
}

describe('canonical canvas drag contracts', () => {
    it('decodes existing built-in and template asset payloads', () => {
        const builtin = transfer({ [DRAG_MIME_ASSET_BUILTIN]: JSON.stringify({ kind: 'number', label: 'Number' }) });
        expect(acceptsCanonicalCanvasDrop(builtin)).toBe(true);
        expect(readCanonicalAssetDrag(builtin)).toEqual({ kind: 'builtin', field_type: 'number', label: 'Number' });

        const template = transfer({ [DRAG_MIME_ASSET_TEMPLATE]: JSON.stringify({ id: 'template:1', name: 'Quantity', kind: 'number' }) });
        expect(readCanonicalAssetDrag(template)).toEqual({ kind: 'template', template_id: 'template:1', label: 'Quantity' });
    });
});
