import * as React from 'react';
import { cn } from '@/lib/utils';
import { DialogParentContext } from './create-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
    DialogWrapperProps,
    DialogHeaderProps,
    DialogContentProps,
    DialogFooterProps,
    DialogTitleProps,
    DialogCloseProps,
    DialogLayoutContextValue,
} from './dialog-manager.types';

export const DialogLayoutContext = React.createContext<DialogLayoutContextValue | null>(null);

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
            <path
                fillRule="evenodd"
                d="M10 8.586 4.293 2.879 2.879 4.293 8.586 10l-5.707 5.707 1.414 1.414L10 11.414l5.707 5.707 1.414-1.414L11.414 10l5.707-5.707-1.414-1.414L10 8.586Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * DialogWrapper — the root of a compound dialog layout.
 *
 * Internally uses CSS Grid with three named rows:
 *   Row 1 (auto)         → DialogHeader
 *   Row 2 (minmax(0,1fr))→ DialogContent  ← the scroll zone
 *   Row 3 (auto)         → DialogFooter
 *
 * Row 2 always has a definite height from the grid algorithm, which lets
 * the inner ScrollArea resolve height:100% reliably — something that
 * flex-1 alone cannot guarantee without an explicit height on every ancestor.
 *
 * Each compound child declares its own `gridRow` inline so the layout is
 * correct even if the user omits one of the three slots.
 */
export const DialogWrapper = React.forwardRef<HTMLDivElement, DialogWrapperProps>(
    ({ children, className, style, ...props }, ref) => {
        const parentCtx = React.useContext(DialogParentContext);

        const contextValue = React.useMemo<DialogLayoutContextValue>(() => ({
            title: parentCtx?.title,
            open: parentCtx?.open ?? false,
            close: parentCtx?.close ?? (() => {}),
        }), [parentCtx]);

        return (
            <DialogLayoutContext.Provider value={contextValue}>
                <div
                    ref={ref}
                    data-slot="dialog-wrapper"
                    className={cn('h-full w-full', className)}
                    style={{
                        display: 'grid',
                        gridTemplateRows: 'auto minmax(0, 1fr) auto',
                        ...style,
                    }}
                    {...props}
                >
                    {children}
                </div>
            </DialogLayoutContext.Provider>
        );
    }
);
DialogWrapper.displayName = 'DialogWrapper';

/** Row 1 of the compound grid — always auto-sized. */
export const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
    ({ children, className, style, ...props }, ref) => {
        return (
            <div
                ref={ref}
                data-slot="dialog-header"
                className={cn('flex flex-col gap-2 p-6 pb-4 border-b', className)}
                style={{ gridRow: 1, ...style }}
                {...props}
            >
                {children}
            </div>
        );
    }
);
DialogHeader.displayName = 'DialogHeader';

export const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
    ({ className, ...props }, ref) => {
        const ctx = React.useContext(DialogLayoutContext);
        if (!ctx) {
            throw new Error('DialogTitle must be used within a DialogWrapper');
        }

        if (!ctx.title) return null;

        return (
            <h2
                ref={ref}
                data-slot="dialog-title"
                className={cn('text-lg leading-none font-semibold tracking-tight', className)}
                {...props}
            >
                {ctx.title}
            </h2>
        );
    }
);
DialogTitle.displayName = 'DialogTitle';

export const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
    ({ className, ...props }, ref) => {
        const ctx = React.useContext(DialogLayoutContext);
        if (!ctx) {
            throw new Error('DialogClose must be used within a DialogWrapper');
        }

        return (
            <button
                ref={ref}
                type="button"
                data-slot="dialog-close"
                onClick={ctx.close}
                aria-label="Close dialog"
                className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:cursor-pointer transition-colors',
                    className
                )}
                {...props}
            >
                <CloseIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </button>
        );
    }
);
DialogClose.displayName = 'DialogClose';

/**
 * Row 2 of the compound grid — the scrollable content zone.
 *
 * The grid gives this row a definite height (minmax(0, 1fr)).
 * ScrollArea with height:100% fills it exactly, so Radix can detect
 * overflow and render its custom scrollbar thumb.
 *
 * `className`      → applied to the outer grid-cell div (sizing, bg, etc.)
 * `innerClassName` → applied to the inner padding wrapper inside ScrollArea
 */
export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
    ({ children, className, innerClassName }, ref) => {
        return (
            <div
                ref={ref}
                data-slot="dialog-content"
                className={cn('overflow-hidden', className)}
                style={{ gridRow: 2 }}
            >
                <ScrollArea style={{ height: '100%' }}>
                    <div className={cn('p-6', innerClassName)}>
                        {children}
                    </div>
                </ScrollArea>
            </div>
        );
    }
);
DialogContent.displayName = 'DialogContent';

/** Row 3 of the compound grid — always auto-sized. */
export const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
    ({ children, className, style, ...props }, ref) => {
        return (
            <div
                ref={ref}
                data-slot="dialog-footer"
                className={cn('flex justify-end gap-3 p-6 pt-4 border-t', className)}
                style={{ gridRow: 3, ...style }}
                {...props}
            >
                {children}
            </div>
        );
    }
);
DialogFooter.displayName = 'DialogFooter';
