// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { definition } from '../../backend/canonical/seed/definition';
import { createCanonicalInspectorNode } from './property-model';

describe('canonical property model', () => {
    it('derives filter, field, and nested option presentation without legacy nodes', () => {
        expect(createCanonicalInspectorNode(definition, 'filter:platform')).toMatchObject({ kind: 'filter', binding: 'Root filter' });
        expect(createCanonicalInspectorNode(definition, 'field:service')).toMatchObject({ kind: 'field', binding: 'Platform' });
        expect(createCanonicalInspectorNode(definition, 'option:instagram-followers')).toMatchObject({ kind: 'option', binding: 'Service' });
    });
});
