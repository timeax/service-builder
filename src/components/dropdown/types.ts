import * as React from 'react';

/** Icon can be a component (preferred) or a node */
export type IconType = React.ComponentType<{ className?: string }> | React.ReactNode;

/** Context passed to dynamic predicates */
export type VisibilityCtx = {
    /** Supply anything useful from your app (route, perms, feature flags, etc.) */
    [k: string]: unknown;
};

/** Minor density tweaks */
export type DropdownSize = 'sm' | 'md';

/** Render override context for row interiors */
export type RenderItemCtx = {
    node: MenuNode;
    /** Default interior: icon + label + (badge|suffix) + shortcut */
    defaultContent: React.ReactNode;
    size: DropdownSize;
};

export type LinkComponentProps = {
    [key: string]: unknown; // destination prop (href|to) plus any others
    children: React.ReactNode;
    className?: string;
};

export type LinkComponentType = React.ComponentType<LinkComponentProps>;

/** Common props shared across all renderable nodes */
export type BaseNode = {
    /** Stable identifier for keys & analytics */
    id?: string | number;

    /** Visible label (text or node) */
    label?: React.ReactNode;

    /** Leading icon (component or node) */
    icon?: IconType;

    /** Optional small description under label */
    description?: React.ReactNode;

    /** Right-aligned keyboard hint (e.g., "⌘K", "Ctrl+P", "G") */
    shortcut?: string;

    /** Right-side badge (count, tag) */
    badge?: React.ReactNode;

    /** Right-side custom content (wins over badge) */
    suffix?: React.ReactNode;

    /** Destructive intent styling */
    danger?: boolean;

    /** Disables interaction */
    disabled?: boolean;

    /** Omits the item from render (static) */
    hidden?: boolean;

    /** Prime parity: visible flag (inverted hidden) */
    visible?: boolean;

    /** Functional visibility */
    hiddenWhen?: (ctx: VisibilityCtx) => boolean;

    /** Optional tooltip displayed on hover/focus */
    tooltip?: React.ReactNode;

    /** Extra className for the row */
    className?: string;

    /** Free-form metadata */
    meta?: Record<string, unknown>;

    /** Accessible name override for screen readers */
    ariaLabel?: string;

    /** For links: mark current location */
    ariaCurrent?: boolean | 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';

    /**
     * Override global default: should the menu close after selecting this item?
     * Useful for toggles or async tasks.
     */
    closeOnSelect?: boolean;

    /** Test hook */
    testId?: string;
};

/** Clickable action item */
export type ActionItem = BaseNode & {
    type?: 'action';
    /**
     * Called when the item is selected; may return a Promise.
     * If it returns a Promise, the row shows loading state until it settles.
     */
    command?: (e: { event: Event; item: ActionItem }) => void | Promise<unknown> | any;
    /**
     * Confirmation UI before executing (inline alert dialog).
     * If provided, the dialog is shown and `command` fires only after confirm.
     */
    confirm?: React.ReactNode | string;
};

/** Link item (navigates) */
export type LinkItem = BaseNode & {
    type: 'link';
    /** Destination (read via DropdownProps.linkKey; "href" by default) */
    href?: string | URL;
    target?: string;
    rel?: string;
    /** Also fires on selection (after navigation intent) */
    command?: (e: { event: Event; item: LinkItem }) => void | Promise<unknown>;
    /** Optional confirm gate too */
    confirm?: React.ReactNode | string;
};

/** Visual separator (explicitly forbids icon) */
export type SeparatorItem = { type: 'separator'; hidden?: boolean; icon?: undefined; id?: any; label?: undefined };

/** Group with optional label */
export type GroupItem = BaseNode & {
    type: 'group';
    items: MenuNode[];
};

/** Submenu with nested items */
export type SubmenuItem = BaseNode & {
    type: 'submenu';
    items: MenuNode[];
};

/** Checkable toggle */
export type CheckboxItem = BaseNode & {
    type: 'checkbox';
    checked: boolean;
    onCheckedChange?: (next: boolean) => void | Promise<unknown>;
};

/** Single radio option inside a radio group */
export type RadioOption = BaseNode & {
    type?: 'radio';
    /** Radio value */
    value: string;
};

/** Mutually-exclusive options */
export type RadioGroupItem = BaseNode & {
    type: 'radio-group';
    value: string;
    onValueChange?: (next: string) => void | Promise<unknown>;
    items: RadioOption[];
};

/** Union of all supported node types */
export type MenuNode = ActionItem | LinkItem | SeparatorItem | GroupItem | SubmenuItem | CheckboxItem | RadioGroupItem;

/** Top-level menu data */
export type MenuData = MenuNode[];
