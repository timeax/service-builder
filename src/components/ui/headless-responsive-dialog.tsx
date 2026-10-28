/* eslint-disable @typescript-eslint/no-explicit-any -- Timeax registry source. */
import * as RadixDialog from '@radix-ui/react-dialog';
import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';
export type DrawerSize = 'sm' | 'default' | 'lg' | 'xl' | 'full' | `w-${string}` | `h-${string}` | `${number}`;

export interface HeadlessResponsiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    className?: string;
    contentClassName?: string;
    scrollbarClassName?: string;
    children: React.ReactNode;

    /** Switch to drawer when viewport ≤ this breakpoint (px). If undefined, stays modal. */
    drawerAt?: number;

    /** Drawer options (when drawerAt matches) */
    drawerSide?: DrawerSide; // default: "bottom"
    drawerSize?: DrawerSize;

    /** When false, clicking outside will NOT close (programmatic or X only). Default true */
    outsideClosable?: boolean;

    /** When false, pressing Escape will NOT close. Default true */
    escapeClosable?: boolean;

    /** Show the X button (ignored when headless). Default true */
    showClose?: boolean;

    /** Headless mode: removes header/close and paddings so host fully controls UI. Default false */
    headless?: boolean;

    /** Optional: aria-label for close button */
    closeLabel?: string;

    /** Limit overall dialog/drawer height as % of viewport height (vh). Default 80 */
    maxVh?: number;
}

const widthMap = { sm: 'w-64', default: 'w-80', lg: 'w-96', xl: 'w-[28rem]', full: 'w-screen' } as const;
const heightMap = { sm: 'h-56', default: 'h-72', lg: 'h-96', xl: 'h-[28rem]', full: 'h-screen' } as const;

const isCustomWH = (v: unknown): v is string => typeof v === 'string' && (v.startsWith('w-') || v.startsWith('h-'));

function drawerSizeClass(side: DrawerSide, size?: DrawerSize): string {
    const s = size ?? 'default';
    if (typeof s === 'number') return side === 'left' || side === 'right' ? `w-[${s}px]` : `h-[${s}px]`;
    if (typeof s === 'string' && /^\d+$/.test(s)) {
        const n = Number(s);
        return side === 'left' || side === 'right' ? `w-[${n}px]` : `h-[${n}px]`;
    }
    if (isCustomWH(s)) return s;
    const map = side === 'left' || side === 'right' ? widthMap : heightMap;
    return (map as Record<string, string>)[s] ?? map.default;
}

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

function useDrawerSwipe(side: DrawerSide, enabled: boolean, onClose: () => void) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const start = React.useRef<{ x: number; y: number } | null>(null);
    const delta = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    React.useEffect(() => {
        if (!enabled || !ref.current) return;

        const el = ref.current;
        let active = false;

        const onDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement;
            if (!target || !target.closest('[data-drawer-grab]')) return;
            active = true;
            el.setPointerCapture(e.pointerId);
            start.current = { x: e.clientX, y: e.clientY };
            delta.current = { x: 0, y: 0 };
            el.style.willChange = 'transform, opacity';
        };

        const onMove = (e: PointerEvent) => {
            if (!active || !start.current) return;
            delta.current = { x: e.clientX - start.current.x, y: e.clientY - start.current.y };

            let tx = 0,
                ty = 0;
            if (side === 'bottom') ty = Math.max(0, delta.current.y);
            if (side === 'top') ty = Math.min(0, delta.current.y);
            if (side === 'left') tx = Math.min(0, delta.current.x);
            if (side === 'right') tx = Math.max(0, delta.current.x);

            el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
            const dist = Math.abs(tx || ty);
            const ease = Math.max(0.5, 1 - dist / 600);
            el.style.opacity = String(ease);
        };

        const onUp = () => {
            if (!active) return;
            active = false;
            const box = el.getBoundingClientRect();
            const dist = Math.abs(side === 'left' || side === 'right' ? delta.current.x : delta.current.y);
            const threshold = Math.min(160, (side === 'left' || side === 'right' ? box.width : box.height) * 0.35);

            if (dist > threshold) {
                el.style.transition = 'transform 180ms ease, opacity 180ms ease';
                if (side === 'bottom') el.style.transform = `translate3d(0, ${box.height}px, 0)`;
                if (side === 'top') el.style.transform = `translate3d(0, -${box.height}px, 0)`;
                if (side === 'left') el.style.transform = `translate3d(-${box.width}px, 0, 0)`;
                if (side === 'right') el.style.transform = `translate3d(${box.width}px, 0, 0)`;
                el.style.opacity = '0';
                window.setTimeout(() => onClose(), 160);
            } else {
                el.style.transition = 'transform 180ms ease, opacity 180ms ease';
                el.style.transform = 'translate3d(0,0,0)';
                el.style.opacity = '1';
                window.setTimeout(() => {
                    el.style.transition = '';
                    el.style.willChange = '';
                }, 180);
            }
        };

        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
        return () => {
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onUp);
        };
    }, [side, enabled, onClose]);

    return ref;
}

export function HeadlessResponsiveDialog({
    open,
    onOpenChange,
    title,
    description,
    className,
    contentClassName,
    scrollbarClassName,
    children,
    drawerAt,
    drawerSide = 'bottom',
    drawerSize,
    outsideClosable = true,
    escapeClosable = true,
    showClose = true,
    headless = false,
    closeLabel = 'Close',
    maxVh = 80,
}: HeadlessResponsiveDialogProps) {
    const matchesDrawer = useIsMobile(drawerAt ?? 0);
    const isDrawer = typeof drawerAt === 'number' && matchesDrawer;

    const allowCloseRef = React.useRef(false);
    const requestClose = React.useCallback(() => {
        allowCloseRef.current = true;
        onOpenChange(false);
        Promise.resolve().then(() => {
            allowCloseRef.current = false;
        });
    }, [onOpenChange]);

    const handleRadixChange = React.useCallback(
        (next: boolean) => {
            if (next === false) {
                if (outsideClosable) return onOpenChange(next);
                if (!allowCloseRef.current && (!outsideClosable || !escapeClosable)) {
                    return;
                }
            }
            onOpenChange(next);
        },
        [onOpenChange, outsideClosable, escapeClosable],
    );

    const onKey = React.useCallback(
        (e: React.KeyboardEvent) => {
            if (!escapeClosable) return;
            e.preventDefault();
            e.stopPropagation();
            requestClose();
        },
        [escapeClosable, requestClose],
    );

    const drawerRef = useDrawerSwipe(drawerSide, isDrawer, requestClose);

    return (
        <RadixDialog.Root open={open} onOpenChange={handleRadixChange}>
            <RadixDialog.Portal>
                <RadixDialog.Overlay
                    className={cn(
                        'fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]',
                        'data-[state=closed]:animate-out data-[state=open]:animate-in',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        !outsideClosable && 'pointer-events-none',
                    )}
                />

                {isDrawer ? (
                    <RadixDialog.Content
                        ref={drawerRef}
                        onEscapeKeyDown={onKey as any}
                        style={{ maxHeight: `${maxVh}vh` }}
                        className={cn(
                            'fixed z-50 border bg-card shadow-lg',
                            'flex flex-col overflow-hidden',
                            drawerSide === 'left' && 'top-0 left-0 h-screen',
                            drawerSide === 'right' && 'top-0 right-0 h-screen',
                            drawerSide === 'top' && 'top-0 left-0 w-screen',
                            drawerSide === 'bottom' && 'bottom-0 left-0 w-screen',
                            drawerSizeClass(drawerSide, drawerSize),
                            'data-[state=closed]:animate-out data-[state=open]:animate-in',
                            drawerSide === 'left' && 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
                            drawerSide === 'right' && 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
                            drawerSide === 'top' && 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
                            drawerSide === 'bottom' && 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
                            className,
                        )}
                    >
                        <div
                            data-drawer-grab
                            className={cn(
                                'flex items-center justify-center cursor-ns-resize touch-none',
                                drawerSide === 'bottom' && 'pt-2 pb-3',
                                drawerSide === 'top' && 'pt-3 pb-2',
                                (drawerSide === 'left' || drawerSide === 'right') && 'py-3',
                            )}
                        >
                            <div
                                className={cn(
                                    'rounded-full bg-muted-foreground/40',
                                    (drawerSide === 'bottom' || drawerSide === 'top') && 'h-1.5 w-12',
                                    (drawerSide === 'left' || drawerSide === 'right') && 'h-12 w-1.5',
                                )}
                            />
                        </div>

                        {!headless && (title || description || showClose) && (
                            <div className="relative border-b px-6 py-4">
                                {(title || description) && (
                                    <div className="pr-10">
                                        {title && <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>}
                                        {description && (
                                            <RadixDialog.Description className="text-sm text-muted-foreground">{description}</RadixDialog.Description>
                                        )}
                                    </div>
                                )}
                                {showClose && (
                                    <button
                                        type="button"
                                        aria-label={closeLabel}
                                        onClick={requestClose}
                                        className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:cursor-pointer"
                                    >
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className={cn('flex-1 overflow-y-auto', headless ? '' : 'p-6')}>{children}</div>
                    </RadixDialog.Content>
                ) : (
                    <RadixDialog.Content
                        onEscapeKeyDown={onKey as any}
                        style={headless
                            ? { height: `${maxVh}vh` }
                            : { maxHeight: `${maxVh}vh` }
                        }
                        className={cn(
                            'fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-lg',
                            'flex flex-col overflow-hidden',
                            'data-[state=closed]:animate-out data-[state=open]:animate-in',
                            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                            className,
                        )}
                    >
                        {headless && <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>}
                        {!headless && (title || description || showClose) && (
                            <div className="relative p-6 pb-2">
                                {(title || description) && (
                                    <div className="pr-10">
                                        {title && (
                                            <RadixDialog.Title className="text-lg leading-none font-semibold tracking-tight">
                                                {title}
                                            </RadixDialog.Title>
                                        )}
                                        {description && (
                                            <RadixDialog.Description className="text-sm text-muted-foreground">{description}</RadixDialog.Description>
                                        )}
                                    </div>
                                )}
                                {showClose && (
                                    <button
                                        type="button"
                                        aria-label={closeLabel}
                                        onClick={requestClose}
                                        className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:cursor-pointer"
                                    >
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}

                        {headless ? (
                            // In headless/compound mode, DialogWrapper manages its own layout.
                            // This container must NOT scroll — just constrain the flex column.
                            <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', scrollbarClassName)}>
                                {children}
                            </div>
                        ) : (
                            // Default shell: ScrollArea scrolls the standard padded content.
                            <ScrollArea className={cn('flex min-h-0 flex-1 flex-col', scrollbarClassName)}>
                                <div className={cn('p-6 pt-4', contentClassName)}>{children}</div>
                            </ScrollArea>
                        )}
                    </RadixDialog.Content>
                )}
            </RadixDialog.Portal>
        </RadixDialog.Root>
    );
}

