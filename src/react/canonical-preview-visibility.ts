// SPDX-License-Identifier: GPL-3.0-only
import type { ResolvedVisibility } from '@elqora/dgp-core';
import type { FieldOption, ProductField } from '@elqora/dgp-spec';

function filterOptions(options: FieldOption[], visibleIds: ReadonlySet<string>): FieldOption[] {
    const filtered = options.flatMap((option) => {
        if (!visibleIds.has(option.id)) return [];
        if (option.children === undefined) return [option];
        const children = filterOptions(option.children, visibleIds);
        return children.length === option.children.length && children.every((child, index) => child === option.children?.[index])
            ? [option]
            : [{ ...option, children }];
    });
    return filtered;
}

/** Project the canonical Ordering visibility result onto fields rendered by a preview. */
export function fieldsVisibleInPreview(fields: readonly ProductField[], visibility: ResolvedVisibility | undefined): ProductField[] {
    if (visibility === undefined) return [];
    const visibleFieldIds = new Set(visibility.fieldIds);
    return fields.flatMap((field) => {
        if (!visibleFieldIds.has(field.id)) return [];
        const visibleOptionIds = visibility.optionsByFieldId[field.id];
        if (field.options === undefined || visibleOptionIds === undefined) return [field];
        const options = filterOptions(field.options, new Set(visibleOptionIds));
        return options.length === field.options.length && options.every((option, index) => option === field.options?.[index])
            ? [field]
            : [{ ...field, options }];
    });
}
