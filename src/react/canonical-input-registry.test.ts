// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { canonicalAuthoringDescriptor } from './canonical-input-registry';

describe('canonical authoring descriptors', () => {
    it('passes canonical defaults, option capabilities, and variants into Workspace field creation', () => {
        const select = canonicalAuthoringDescriptor('select');
        expect(select.variant).toBeUndefined();
        expect(select.defaults).toEqual(expect.any(Object));
        expect(select.options?.auto_create).toBe(true);

        const checkboxOptions = canonicalAuthoringDescriptor('checkbox', 'options');
        expect(checkboxOptions.variant).toBe('options');
        expect(checkboxOptions.multi?.auto_enable).toBe(true);
        expect(checkboxOptions.options?.auto_create).toBe(true);
    });
});
