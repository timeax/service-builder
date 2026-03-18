import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { FiMoreHorizontal } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import { LuSearch } from 'react-icons/lu';

export type BuilderNodeKind = 'tag' | 'field' | 'option' | 'comment';

export type BuilderNodeViewModel = {
    nodeId: string;
    kind: BuilderNodeKind;
    label: string;
    hint?: string;
    meta?: string;
    icon?: ReactNode;
    active?: boolean;
    selected?: boolean;
    accent?: 'default' | 'primary' | 'success' | 'warning';
};

export function BuilderIconButton({
    className,
    active,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
    return (
        <button
            type="button"
            className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition',
                'hover:border-slate-200 hover:bg-white hover:text-slate-900',
                'dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                active && 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

type PanelSearchProps = {
    className?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder' | 'className'>;

export const PanelSearch = forwardRef<HTMLInputElement, PanelSearchProps>(function PanelSearch(
    { className, value, onChange, placeholder = 'Search', ...inputProps },
    ref,
) {
    return (
        <label
            className={cn(
                'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500',
                'focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100',
                'dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:focus-within:border-blue-500/40 dark:focus-within:ring-blue-500/10',
                className,
            )}
        >
            <LuSearch className="text-base" />
            <input
                ref={ref}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
                {...inputProps}
            />
        </label>
    );
});

export function PanelSection({
    title,
    description,
    action,
    children,
    className,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm', 'dark:border-slate-800 dark:bg-slate-950/80', className)}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                    {description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            <div className="p-3">{children}</div>
        </section>
    );
}

export function NodePill({ view, className }: { view: BuilderNodeViewModel; className?: string }) {
    const palette =
        view.kind === 'tag'
            ? 'border-slate-200 bg-white text-slate-800'
            : view.kind === 'field'
              ? 'border-slate-200 bg-white text-slate-700'
              : view.kind === 'option'
                ? 'border-blue-100 bg-blue-50 text-blue-700'
                : 'border-amber-100 bg-amber-50 text-amber-700';

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition',
                palette,
                view.active && 'ring-2 ring-blue-200',
                view.selected && 'border-blue-300 bg-blue-50 text-blue-700',
                className,
            )}
        >
            {view.icon ? <span className="text-base">{view.icon}</span> : null}
            <span className="truncate">{view.label}</span>
        </div>
    );
}

export function NodeCard({
    view,
    className,
    onClick,
    children,
}: {
    view: BuilderNodeViewModel;
    className?: string;
    onClick?: () => void;
    children?: ReactNode;
}) {
    const palette =
        view.kind === 'tag'
            ? 'from-white to-slate-50/90'
            : view.kind === 'field'
              ? 'from-white to-slate-50/80'
              : view.kind === 'option'
                ? 'from-blue-50 to-white'
                : 'from-amber-50 to-white';

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group relative flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br p-4 text-left shadow-sm transition',
                'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg',
                'dark:border-slate-800 dark:hover:border-slate-700',
                palette,
                view.active && 'border-blue-300 shadow-blue-100/80 ring-2 ring-blue-100 dark:border-blue-500/50 dark:ring-blue-500/10',
                view.selected && 'border-blue-300 bg-blue-50/70 dark:bg-blue-500/10',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {view.icon ? <span className="text-base text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200">{view.icon}</span> : null}
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{view.label}</p>
                    </div>
                    {view.hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{view.hint}</p> : null}
                </div>
                <SelectionBadge active={view.active} selected={view.selected} />
            </div>
            {children}
            {view.meta ? <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{view.meta}</p> : null}
        </button>
    );
}

export function SelectionBadge({ active, selected, className }: { active?: boolean; selected?: boolean; className?: string }) {
    const label = active ? 'Active' : selected ? 'Selected' : 'Idle';
    const tone = active
        ? 'bg-blue-600 text-white'
        : selected
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

    return <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', tone, className)}>{label}</span>;
}

export function EmptyState({
    title,
    description,
    action,
    className,
}: {
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center',
                'dark:border-slate-700 dark:bg-slate-900/40',
                className,
            )}
        >
            <div className="mb-3 rounded-full bg-white p-3 text-blue-500 shadow-sm dark:bg-slate-950">
                <HiOutlineSparkles className="text-xl" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
            <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

export function InspectorRow({
    label,
    value,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('grid grid-cols-[minmax(90px,120px)_1fr] items-start gap-3', className)}>
            <div className="pt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</div>
            <div>{value}</div>
        </div>
    );
}

export function PropertyGroup({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950', className)}>
            <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
                {description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
            </div>
            {children}
        </div>
    );
}

export function PropertyList({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string }) {
    return (
        <div className={cn('space-y-2', className)}>
            {items.map((item, index) => (
                <div key={index} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                    <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">{item.value}</span>
                </div>
            ))}
        </div>
    );
}

export function StatusDot({ tone = 'default', className }: { tone?: 'default' | 'success' | 'warning' | 'danger'; className?: string }) {
    const palette =
        tone === 'success' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-amber-500' : tone === 'danger' ? 'bg-rose-500' : 'bg-slate-400';
    return <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', palette, className)} />;
}

export function ToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur',
                'dark:border-slate-800 dark:bg-slate-950/90',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function CanvasOverlay({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/85', className)}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                    {description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
                </div>
                <FiMoreHorizontal className="mt-0.5 text-slate-400" />
            </div>
            {children ? <div className="mt-3">{children}</div> : null}
        </div>
    );
}

export function ContextMenuItem({
    icon,
    title,
    hint,
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; title: string; hint?: string }) {
    return (
        <button
            type="button"
            className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900',
                className,
            )}
            {...props}
        >
            {icon ? <span className="text-slate-400">{icon}</span> : null}
            <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div>
                {hint ? <div className="truncate text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
            </div>
        </button>
    );
}

export function InlineEditableLabel({
    value,
    onChange,
    className,
    placeholder = 'Untitled',
}: {
    value: string;
    onChange: (next: string) => void;
    className?: string;
    placeholder?: string;
}) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
                'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition',
                'focus:border-blue-300 focus:ring-2 focus:ring-blue-100',
                'dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10',
                className,
            )}
        />
    );
}

export function PresenceAvatar({
    src,
    name,
    active,
}: {
    src?: string;
    name: string;
    active?: boolean;
}) {
    const initials = name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="relative">
            <Avatar className="h-8 w-8 border border-white shadow-sm dark:border-slate-950">
                {src ? <AvatarImage src={src} alt={name} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {active ? <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" /> : null}
        </div>
    );
}

export function GhostAction({
    children,
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <Button
            variant="ghost"
            className={cn('h-8 rounded-xl px-3 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100', className)}
            {...props}
        >
            {children}
        </Button>
    );
}
