// components/ui/paper.tsx
import * as React from 'react';
import {cn} from '@/lib/utils';

export type PaperProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Additional classes merged after the defaults */
    className?: string;
};

/**
 * Paper
 * - Always uses bg-paper & text-paper-foreground
 * - Tiny rounding by default via `rounded-paper`
 * - No border by default (opt-in with `border-paper`)
 */
export const Paper = React.forwardRef<HTMLDivElement, PaperProps>(
    ({className, ...props}, ref) => {
        return (
            <div
                ref={ref}
                data-ui="paper"
                className={cn(
                    'bg-paper text-paper-foreground rounded-paper',
                    className,
                )}
                {...props}
            />
        );
    }
);

Paper.displayName = 'Paper';
