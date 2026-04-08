import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import * as React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

function ResizablePanelGroup({
    className,
    direction = 'horizontal',
    ...props
}: React.ComponentProps<typeof Group> & { direction?: 'horizontal' | 'vertical' }) {
    return <Group className={cn('flex h-full w-full data-[group-orientation=vertical]:flex-col', className)} orientation={direction} {...props} />;
}

function ResizablePanel({
    className,
    ...props
}: React.ComponentProps<typeof Panel>) {
    return <Panel className={cn('min-h-0 min-w-0', className)} {...props} />;
}

function ResizableHandle({
    withHandle,
    className,
    ...props
}: React.ComponentProps<typeof Separator> & { withHandle?: boolean }) {
    return (
        <Separator
            className={cn(
                'relative flex w-3 shrink-0 items-center justify-center bg-transparent outline-none transition-colors after:absolute after:inset-y-3 after:left-1/2 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-slate-200 dark:after:bg-slate-800',
                'hover:after:bg-slate-300 dark:hover:after:bg-slate-700',
                className,
            )}
            {...props}
        >
            {withHandle ? (
                <div className="z-10 flex h-10 w-3 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
                    <GripVertical className="h-3.5 w-3.5" />
                </div>
            ) : null}
        </Separator>
    );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
