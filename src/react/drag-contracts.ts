// SPDX-License-Identifier: GPL-3.0-only
export const DRAG_MIME_SERVICE = 'application/x-service-builder-service';
export const DRAG_MIME_ASSET_BUILTIN = 'application/x-service-builder-asset-builtin';
export const DRAG_MIME_ASSET_TEMPLATE = 'application/x-service-builder-asset-template';

export type CanonicalAssetDragPayload =
    | { kind: 'builtin'; field_type: string; label: string; variant?: string }
    | { kind: 'template'; template_id: string; label: string };

export function readCanonicalAssetDrag(data: DataTransfer): CanonicalAssetDragPayload | null {
    const builtin = data.getData(DRAG_MIME_ASSET_BUILTIN);
    if (builtin) { try { const value = JSON.parse(builtin); return { kind: 'builtin', field_type: String(value.kind ?? 'text'), label: String(value.label ?? 'New Field'), ...(value.variant === undefined ? {} : { variant: String(value.variant) }) }; } catch { return null; } }
    const template = data.getData(DRAG_MIME_ASSET_TEMPLATE);
    if (template) { try { const value = JSON.parse(template); return { kind: 'template', template_id: String(value.id ?? ''), label: String(value.name ?? 'New Field') }; } catch { return null; } }
    return null;
}

export function acceptsCanonicalCanvasDrop(data: DataTransfer) {
    return data.types.includes(DRAG_MIME_SERVICE) || data.types.includes(DRAG_MIME_ASSET_BUILTIN) || data.types.includes(DRAG_MIME_ASSET_TEMPLATE);
}
