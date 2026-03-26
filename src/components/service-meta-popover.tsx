import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FiInfo } from 'react-icons/fi';
import { flattenServiceMeta } from './service-meta.ts';

type ServiceMetaPopoverProps = {
    meta: unknown;
    className?: string;
    iconClassName?: string;
    popoverClassName?: string;
    ariaLabel?: string;
    hoverDelayMs?: number;
    stopEventPropagation?: boolean;
};

export function ServiceMetaPopover({
    meta,
    className,
    iconClassName,
    popoverClassName,
    ariaLabel = 'More service info',
    hoverDelayMs = 600,
    stopEventPropagation = false,
}: ServiceMetaPopoverProps) {
    const rows = useMemo(() => flattenServiceMeta(meta), [meta]);
    const [open, setOpen] = useState(false);
    const openTimerRef = useRef<number | null>(null);
    const closeTimerRef = useRef<number | null>(null);

    const clearTimers = () => {
        if (openTimerRef.current != null) {
            window.clearTimeout(openTimerRef.current);
            openTimerRef.current = null;
        }
        if (closeTimerRef.current != null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    useEffect(() => () => clearTimers(), []);

    const scheduleOpen = () => {
        if (open) return;
        clearTimers();
        openTimerRef.current = window.setTimeout(() => {
            setOpen(true);
            openTimerRef.current = null;
        }, hoverDelayMs);
    };

    const scheduleClose = () => {
        clearTimers();
        closeTimerRef.current = window.setTimeout(() => {
            setOpen(false);
            closeTimerRef.current = null;
        }, 80);
    };

    const handleTriggerToggle = (event: MouseEvent<HTMLButtonElement>) => {
        if (stopEventPropagation) {
            event.preventDefault();
            event.stopPropagation();
        }
        clearTimers();
        setOpen((current) => !current);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={ariaLabel}
                    onPointerEnter={scheduleOpen}
                    onPointerLeave={scheduleClose}
                    onClick={handleTriggerToggle}
                    onPointerDown={(event) => {
                        if (!stopEventPropagation) return;
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    className={cn(
                        'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900',
                        className,
                    )}
                >
                    <FiInfo className={cn('text-sm', iconClassName)} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className={cn('w-[min(30rem,calc(100vw-2rem))] rounded-xl p-0', popoverClassName)}
                onPointerEnter={() => clearTimers()}
                onPointerLeave={scheduleClose}
            >
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">More info</h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Meta properties</p>
                </div>
                {rows.length ? (
                    <ScrollArea className="max-h-72">
                        <div className="space-y-2 p-4">
                            {rows.map((row) => (
                                <div
                                    key={`${row.key}:${row.value}`}
                                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0 dark:border-slate-800"
                                >
                                    <div className="truncate text-slate-500 dark:text-slate-400">{row.key}</div>
                                    <div className="break-all text-right font-medium text-slate-900 dark:text-slate-100">{row.value}</div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No primitive meta properties available.</div>
                )}
            </PopoverContent>
        </Popover>
    );
}
