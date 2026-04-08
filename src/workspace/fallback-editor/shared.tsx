import { Button } from '@/components/ui/button.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export const surfaceClassName =
    'rounded-md border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/85';

export function SectionCard({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return <section className={cn(surfaceClassName, className)}>{children}</section>;
}

export function SectionHeader({
    title,
    description,
    action,
    className,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-start justify-between gap-3', className)}>
            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                {description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    className,
}: {
    title: string;
    description: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40',
                className,
            )}
        >
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
            <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
    );
}

export function DetailRow({
    label,
    value,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-900/70', className)}>
            <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
            <span className="text-right text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>
        </div>
    );
}

export function ToneBadge({
    label,
    tone = 'neutral',
    className,
}: {
    label: string;
    tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
    className?: string;
}) {
    const palette =
        tone === 'info'
            ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200'
            : tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
              : tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                : tone === 'danger'
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300';

    return <span className={cn('inline-flex rounded-md border px-2.5 py-1 text-[11px] font-medium', palette, className)}>{label}</span>;
}

export function ModalShell({
    open,
    title,
    description,
    onClose,
    children,
    footer,
    size = 'default',
}: {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'default' | 'wide';
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className={cn(
                    'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950',
                    size === 'wide' ? 'max-w-4xl' : 'max-w-xl',
                )}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-md">
                        <X className="size-4" />
                    </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    <div className="p-6">{children}</div>
                </ScrollArea>
                {footer ? <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800">{footer}</div> : null}
            </div>
        </div>
    );
}
