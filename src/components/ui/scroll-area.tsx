import * as React from 'react';

import { cn } from '@/lib/utils';

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea({ className, children, ...props }, ref) {
    return (
        <div data-slot="scroll-area" ref={ref} className={cn('relative size-full overflow-auto', className)} {...props}>
            {children}
        </div>
    );
});

type ScrollBarProps = React.HTMLAttributes<HTMLDivElement> & {
    orientation?: 'vertical' | 'horizontal';
};

const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(function ScrollBar({ className, orientation = 'vertical', ...props }, ref) {
    return (
        <div
            data-slot="scroll-area-scrollbar"
            ref={ref}
            aria-hidden="true"
            className={cn(
                'pointer-events-none absolute opacity-0',
                orientation === 'vertical' ? 'right-0 top-0 h-full w-0' : 'bottom-0 left-0 h-0 w-full',
                className,
            )}
            {...props}
        />
    );
});

export { ScrollArea, ScrollBar };
