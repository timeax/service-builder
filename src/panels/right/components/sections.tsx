import * as React from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MdOutlineOpenInNew, MdOutlineRemoveCircleOutline } from 'react-icons/md';
import { TiWarning } from 'react-icons/ti';

/* -------------------------------------------------------------------------------------------------
 * Section
 * - Collapsible shell with subcomponents:
 *   <Section>
 *     <Section.Title>...</Section.Title>
 *     <Section.Actions>...</Section.Actions>
 *     <Section.Content>...</Section.Content>
 *   </Section>
 * - No padding is applied by Section itself.
 * - You control borders/separators outside/around it.
 * ------------------------------------------------------------------------------------------------- */

type SectionCtxValue = {
    open: boolean;
    setOpen: (v: boolean) => void;
};

const SectionCtx = React.createContext<SectionCtxValue | null>(null);

function useSectionCtx() {
    const ctx = React.useContext(SectionCtx);
    if (!ctx) throw new Error('Section.* must be used inside <Section/>');
    return ctx;
}

export type SectionProps = {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    children: React.ReactNode;
};

function SectionRoot({ defaultOpen = true, open: controlledOpen, onOpenChange, className, children }: SectionProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const isControlled = typeof controlledOpen === 'boolean';
    const open = isControlled ? controlledOpen : uncontrolledOpen;

    const setOpen = React.useCallback(
        (v: boolean) => {
            if (!isControlled) setUncontrolledOpen(v);
            onOpenChange?.(v);
        },
        [isControlled, onOpenChange],
    );

    const ctx = React.useMemo<SectionCtxValue>(() => ({ open, setOpen }), [open, setOpen]);

    return (
        <SectionCtx.Provider value={ctx}>
            <Collapsible open={open} onOpenChange={setOpen}>
                <div className={cn('w-full', className)}>{children}</div>
            </Collapsible>
        </SectionCtx.Provider>
    );
}

/** Header row wrapper: title left + actions right */
type SectionHeaderProps = React.HTMLAttributes<HTMLDivElement>;
function SectionHeader({ className, ...props }: SectionHeaderProps) {
    return <div className={cn('flex items-center justify-between gap-3', className)} {...props} />;
}

type SectionTitleProps = React.PropsWithChildren<{
    className?: string;
    /** Optional: replace the default title element */
    asChild?: boolean;
}>;

/**
 * Title is also the CollapsibleTrigger.
 * Default: renders a button with "text-sm font-semibold ..."
 */
function SectionTitle({ className, children }: SectionTitleProps) {
    return (
        <CollapsibleTrigger asChild>
            <button
                type="button"
                className={cn(
                    'inline-flex min-w-0 items-center gap-2 text-left',
                    // title style
                    'text-sm font-semibold text-gray-800 dark:text-gray-200',
                    // affordance (no padding)
                    'hover:opacity-90',
                    className,
                )}
            >
                {children}
            </button>
        </CollapsibleTrigger>
    );
}

type SectionActionsProps = React.HTMLAttributes<HTMLDivElement>;
function SectionActions({ className, ...props }: SectionActionsProps) {
    return <div className={cn('flex items-center gap-2', className)} {...props} />;
}

type SectionContentProps = React.HTMLAttributes<HTMLDivElement>;
function SectionContent({ className, ...props }: SectionContentProps) {
    const state = useSectionCtx();
    return (
        <CollapsibleContent asChild>
            <div className={cn('w-full', { 'mt-3': state.open }, className)} {...props} />
        </CollapsibleContent>
    );
}

export const Section = Object.assign(SectionRoot, {
    Header: SectionHeader,
    Title: SectionTitle,
    Actions: SectionActions,
    Content: SectionContent,
});

/* -------------------------------------------------------------------------------------------------
 * SectionActionButton (icon + label)
 * - Matches your “Add / Set” pattern.
 * ------------------------------------------------------------------------------------------------- */

export type SectionActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: React.ReactNode;
};

export function SectionActionButton({ className, icon, children, ...props }: SectionActionButtonProps) {
    return (
        <button
            type="button"
            className={cn(
                'flex cursor-pointer items-center gap-1 text-sm font-medium text-primary',
                'hover:text-blue-700 dark:hover:text-blue-400',
                className,
            )}
            {...props}
        >
            {icon}
            <span>{children}</span>
        </button>
    );
}

/* -------------------------------------------------------------------------------------------------
 * Includes UI (you said you like this)
 * - IncludesList
 * - IncludesItem (neutral row)
 * - IncludesItemMissing (error row)
 * - ConflictBadge
 * ------------------------------------------------------------------------------------------------- */

export type IncludesAction = {
    kind: 'open' | 'remove';
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    icon?: React.ReactNode;
    /** default styles depend on kind */
    className?: string;
};

export type IncludesItemProps = {
    title: string;
    badge?: React.ReactNode; // e.g. <ConflictBadge />
    actions?: IncludesAction[];
    className?: string;
};

export function IncludesList({ className, children }: React.PropsWithChildren<{ className?: string }>) {
    return <div className={cn('space-y-2', className)}>{children}</div>;
}

/** Neutral list row: gray bg, right-side actions */
export function IncludesItem({ title, badge, actions, className }: IncludesItemProps) {
    return (
        <div className={cn('flex items-center justify-between rounded-md p-2', 'bg-gray-50 dark:bg-gray-800/50', className)}>
            <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-gray-800 dark:text-gray-200">{title}</span>
                {badge}
            </div>

            {!!actions?.length && (
                <div className="flex items-center gap-2">
                    {actions.map((a, idx) => (
                        <IncludesIconAction key={idx} {...a} />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Error row variant (Missing Target) */
export function IncludesItemMissing({
    message,
    onRemove,
    className,
    icon,
}: {
    message: string;
    onRemove?: () => void;
    icon?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center justify-between rounded-md p-2', 'bg-red-50 dark:bg-red-900/20', className)}>
            <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-base text-red-500 dark:text-red-400">
                    {icon ?? (
                        <span className="material-symbols-outlined">
                            <TiWarning />
                        </span>
                    )}
                </span>
                <span className="truncate text-sm text-red-700 dark:text-red-300">{message}</span>
            </div>

            <button
                type="button"
                onClick={onRemove}
                className={cn('text-gray-400 hover:text-red-500 dark:hover:text-red-400')}
                aria-label="Remove"
                title="Remove"
            >
                <span className="text-lg">
                    <MdOutlineRemoveCircleOutline />
                </span>
            </button>
        </div>
    );
}

export function ConflictBadge({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
                className,
            )}
        >
            Conflict
        </span>
    );
}

function IncludesIconAction({ kind, onClick, disabled, title, icon, className }: IncludesAction) {
    const base = 'cursor-pointer text-gray-400 dark:text-gray-400 disabled:opacity-50 disabled:pointer-events-none';
    const hover = kind === 'remove' ? 'hover:text-red-500 dark:hover:text-red-400' : 'hover:text-gray-600 dark:hover:text-gray-300';

    const defaultIcon = kind === 'remove' ? <MdOutlineRemoveCircleOutline /> : <MdOutlineOpenInNew />;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(base, hover, className)}
            aria-label={title ?? kind}
            title={title ?? kind}
        >
            {icon ?? <span className="material-symbols-outlined text-lg">{defaultIcon}</span>}
        </button>
    );
}

/* -------------------------------------------------------------------------------------------------
 * Example usage (drop into your panel body)
 * ------------------------------------------------------------------------------------------------- */

// export function ExampleRightPanelSections() {
//     return (
//         <div className="space-y-4">
//             <Section defaultOpen>
//                 <Section.Header>
//                     <Section.Title>Includes</Section.Title>
//                     <Section.Actions>
//                         <SectionActionButton
//                             icon={<span className="material-symbols-outlined text-lg">add</span>}
//                             onClick={() => {}}
//                         >
//                             Add
//                         </SectionActionButton>
//                     </Section.Actions>
//                 </Section.Header>

//                 <Section.Content className="mt-3">
//                     <IncludesList>
//                         <IncludesItem
//                             title="Homepage Banner"
//                             actions={[
//                                 { kind: "open", onClick: () => {} },
//                                 { kind: "remove", onClick: () => {} },
//                             ]}
//                         />
//                         <IncludesItemMissing
//                             message="Missing Target (ID: node_xyz)"
//                             onRemove={() => {}}
//                         />
//                         <IncludesItem
//                             title="Seasonal Sale Page"
//                             badge={<ConflictBadge />}
//                             actions={[
//                                 { kind: "open", onClick: () => {} },
//                                 { kind: "remove", onClick: () => {} },
//                             ]}
//                         />
//                     </IncludesList>
//                 </Section.Content>
//             </Section>

//             <div className="border-t border-gray-200 dark:border-gray-700" />

//             <Section defaultOpen={false}>
//                 <Section.Header>
//                     <Section.Title>Excludes</Section.Title>
//                     <Section.Actions>
//                         <SectionActionButton
//                             icon={<span className="material-symbols-outlined text-lg">add</span>}
//                             onClick={() => {}}
//                         >
//                             Add
//                         </SectionActionButton>
//                     </Section.Actions>
//                 </Section.Header>

//                 <Section.Content className="mt-3">
//                     <div className="text-sm text-gray-500 dark:text-gray-400">None</div>
//                 </Section.Content>
//             </Section>
//         </div>
//     );
// }
