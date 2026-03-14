import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Label
 * A tiny text primitive with variants that match the styles used in your HTML snippet.
 *
 * Notes:
 * - This is NOT the shadcn <Label /> (form label). It’s a general text component.
 * - If you already have a "Text" primitive, merge these variants there instead.
 */

export type LabelVariant =
    | 'sectionTitle' // h3 titles like "Includes", "Service"
    | 'fieldLabel' // small gray labels like "Type", "Label", "ID"
    | 'value' // normal value text
    | 'valueStrong' // value text that is medium/strong
    | 'muted' // empty state / helper text
    | 'danger' // error row message
    | 'dangerMuted' // error-ish muted (rare)
    | 'success' // status available
    | 'badge' // base badge text (use with Badge component if you have one)
    | 'chip'; // chips like "Refill", "Fast"

export type LabelProps = React.HTMLAttributes<HTMLElement> & {
    as?: keyof JSX.IntrinsicElements;
    variant?: LabelVariant;
    truncate?: boolean;
};

const labelStyles: Record<LabelVariant, string> = {
    // Titles (h3)
    sectionTitle: 'text-sm font-semibold text-gray-800 dark:text-gray-200',

    // Small, subtle labels
    fieldLabel: 'block text-xs font-medium text-gray-500 dark:text-gray-400',

    // Value text
    value: 'text-sm text-gray-800 dark:text-gray-200',
    valueStrong: 'text-sm font-medium text-gray-800 dark:text-gray-200',

    // Muted/empty state
    muted: 'text-sm text-gray-500 dark:text-gray-400',

    // Error messaging (Missing Target)
    danger: 'text-sm text-red-700 dark:text-red-300',
    dangerMuted: 'text-xs font-medium text-red-600 dark:text-red-400',

    // Status (Available)
    success: 'text-sm text-emerald-600 dark:text-emerald-400',

    // Generic “badge/chip” text bases (color left to container)
    badge: 'text-xs font-medium',
    chip: 'text-xs font-medium',
};

export function Label({ as: Comp = 'span', variant = 'value', truncate, className, ...props }: LabelProps) {
    //@ts-ignore
    return <Comp className={cn(labelStyles[variant], truncate && 'min-w-0 truncate', className)} {...props} />;
}

/* ---------------------------------------------
 * Optional helpers (still “text primitives”)
 * --------------------------------------------- */

export function FieldLabel(props: Omit<LabelProps, 'variant'>) {
    return <Label variant="fieldLabel" {...props} />;
}

export function SectionTitle(props: Omit<LabelProps, 'variant'>) {
    return <Label as="h3" variant="sectionTitle" {...props} />;
}

export function MutedText(props: Omit<LabelProps, 'variant'>) {
    return <Label variant="muted" {...props} />;
}

/* ---------------------------------------------
 * Example usage
 * --------------------------------------------- */

// <FieldLabel>Type</FieldLabel>
// <Label variant="valueStrong">Tag</Label>

// <SectionTitle>Includes</SectionTitle>

// <MutedText>None</MutedText>

// <Label variant="danger" truncate>
//   Missing Target (ID: node_xyz)
// </Label>

// <Label variant="success">Available</Label>
