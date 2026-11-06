// SPDX-License-Identifier: GPL-3.0-only
import { createDefaultFormPaletteRegistry } from '@elqora/dgp-ordering-form-palette';
import type { AuthoringFieldDescriptor } from '@elqora/dgp-workspace';

export const canonicalInputRegistry = createDefaultFormPaletteRegistry();

const radioDescriptor = canonicalInputRegistry.resolve('radio');
if (radioDescriptor) {
    canonicalInputRegistry.register_many([
        {
            ...radioDescriptor,
            adapter: {
                ...radioDescriptor.adapter,
                get_selected_option_ids(change, stored, context) {
                    const selected = radioDescriptor.adapter.get_selected_option_ids?.(change, stored, context) ?? [];
                    const options = context.field.options ?? [];
                    return selected.map((value) => {
                        const option = options.find((candidate) => String(candidate.id) === value || String(candidate.value) === value);
                        return option ? String(option.id) : value;
                    });
                },
            },
        },
    ]);
}

export function canonicalAuthoringDescriptor(type: string, variant?: string): AuthoringFieldDescriptor {
    const descriptor = canonicalInputRegistry.resolve(type, variant);
    if (!descriptor || (variant && variant !== 'default' && descriptor.variant !== variant))
        return { type, ...(variant && variant !== 'default' ? { variant } : {}) };
    return {
        type: descriptor.type,
        ...(descriptor.variant && descriptor.variant !== 'default' ? { variant: descriptor.variant } : {}),
        defaults: structuredClone(descriptor.default_props) as AuthoringFieldDescriptor['defaults'],
        ui: descriptor.ui,
        options: descriptor.option_capability,
        multi: descriptor.multi_capability,
    };
}
