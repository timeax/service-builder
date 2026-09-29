// SPDX-License-Identifier: GPL-3.0-only
import { createDefaultFormPaletteRegistry } from '@elqora/dgp-ordering-form-palette';
import type { AuthoringFieldDescriptor } from '@elqora/dgp-workspace';

export const canonicalInputRegistry = createDefaultFormPaletteRegistry();

export function canonicalAuthoringDescriptor(type: string, variant?: string): AuthoringFieldDescriptor {
    const descriptor = canonicalInputRegistry.resolve(type, variant);
    if (!descriptor || (variant && variant !== 'default' && descriptor.variant !== variant)) return { type, ...(variant && variant !== 'default' ? { variant } : {}) };
    return {
        type: descriptor.type,
        ...(descriptor.variant && descriptor.variant !== 'default' ? { variant: descriptor.variant } : {}),
        defaults: structuredClone(descriptor.default_props) as AuthoringFieldDescriptor['defaults'],
        ui: descriptor.ui,
        options: descriptor.option_capability,
        multi: descriptor.multi_capability,
    };
}
