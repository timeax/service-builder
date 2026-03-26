import { cn } from '@/lib/utils.ts';

export function toolbarSurfaceClass(className?: string) {
    return cn('pointer-events-auto inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-md dark:border-slate-800 dark:bg-slate-950/95', className);
}

export function toolbarSplitSurfaceClass(className?: string) {
    return cn('pointer-events-auto inline-flex items-center rounded-lg border border-slate-200 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-950/95', className);
}

export function toolbarIconButtonClass(active = false, className?: string) {
    return cn('h-8 w-8', active && 'text-blue-600', className);
}
