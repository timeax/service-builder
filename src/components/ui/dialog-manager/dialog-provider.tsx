/* eslint-disable -- Timeax registry source retained for createDialog compatibility. */
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import * as Popover from '@radix-ui/react-popover';
import * as React from 'react';
import { getDialogStore } from './dialog-store';
import type { ContentOverride, DialogContextValue } from './dialog-manager.types';

type ConfirmEntry = {
    id: string;
    content: React.ReactNode;
    title?: React.ReactNode;
    acceptLabel?: React.ReactNode;
    cancelLabel?: React.ReactNode;
    onAccept?: () => void;
    onReject?: () => void;
    resolve: (ok: boolean) => void;
    open: boolean;
};

type PopupEntry = ConfirmEntry & {
    anchor: HTMLElement;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
};

function coerceMessage(
    input?: React.ReactNode | ContentOverride,
    fallback?: React.ReactNode
): Pick<ConfirmEntry, 'content' | 'title' | 'acceptLabel' | 'cancelLabel'> {
    if (isContentOverride(input)) {
        return {
            content: input.content ?? fallback,
            title: input.title,
            acceptLabel: input.acceptLabel,
            cancelLabel: input.cancelLabel,
        };
    }
    return { content: input ?? fallback };
}

function isContentOverride(x: unknown): x is ContentOverride {
    if (!x || typeof x !== 'object') return false;
    const allowed = new Set(['content', 'title', 'acceptLabel', 'cancelLabel']);
    const keys = Object.keys(x as Record<string, unknown>);
    if (keys.length === 0) return false;
    for (const k of keys) {
        if (!allowed.has(k)) return false;
    }
    return true;
}

const DialogCtx = React.createContext<DialogContextValue | null>(null);

export const useDialog = () => {
    const ctx = React.useContext(DialogCtx);
    if (!ctx) {
        throw new Error('useDialog must be used within DialogProvider');
    }
    return ctx;
};

function newId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getScrollParents(el: HTMLElement | null): (HTMLElement | Window)[] {
    const parents: (HTMLElement | Window)[] = [];
    if (!el) return parents;
    let node: HTMLElement | null = el.parentElement;

    const isScrollable = (e: HTMLElement) => {
        const s = getComputedStyle(e);
        const oy = s.overflowY,
            ox = s.overflowX;
        return (
            (oy !== 'visible' && oy !== 'clip' && e.scrollHeight > e.clientHeight) ||
            (ox !== 'visible' && ox !== 'clip' && e.scrollWidth > e.clientWidth)
        );
    };

    while (node && node !== document.body) {
        if (isScrollable(node)) parents.push(node);
        node = node.parentElement;
    }
    parents.push(window);
    return parents;
}

function useLivePopupRects(popups: PopupEntry[]) {
    const [rects, setRects] = React.useState<Record<string, DOMRect>>({});
    const listeners = React.useRef<Map<EventTarget, () => void>>(new Map());
    const frame = React.useRef<number | null>(null);

    const measure = React.useCallback(() => {
        frame.current = null;
        setRects((prev) => {
            const next: Record<string, DOMRect> = {};
            for (const p of popups) {
                const r = p.anchor.getBoundingClientRect();
                const prevR = prev[p.id];
                if (!prevR || prevR.left !== r.left || prevR.top !== r.top || prevR.width !== r.width || prevR.height !== r.height) {
                    next[p.id] = r;
                } else {
                    next[p.id] = prevR;
                }
            }
            return next;
        });
    }, [popups]);

    const schedule = React.useCallback(() => {
        if (frame.current != null) return;
        frame.current = requestAnimationFrame(measure);
    }, [measure]);

    React.useEffect(() => {
        for (const [t, fn] of listeners.current) {
            t.removeEventListener?.('scroll', fn as any);
            t.removeEventListener?.('resize', fn as any);
        }
        listeners.current.clear();

        const attach = (t: EventTarget) => {
            const fn = schedule;
            t.addEventListener?.('scroll', fn as any, { passive: true });
            t.addEventListener?.('resize', fn as any);
            listeners.current.set(t, fn);
        };

        const seen = new Set<EventTarget>();
        for (const p of popups) {
            const parents = getScrollParents(p.anchor);
            for (const par of parents) {
                if (!seen.has(par)) {
                    seen.add(par);
                    attach(par);
                }
            }
        }

        measure();

        return () => {
            for (const [t, fn] of listeners.current) {
                t.removeEventListener?.('scroll', fn as any);
                t.removeEventListener?.('resize', fn as any);
            }
            listeners.current.clear();
            if (frame.current != null) {
                cancelAnimationFrame(frame.current);
                frame.current = null;
            }
        };
    }, [popups, schedule, measure]);

    return rects;
}

type TriggerEvent = React.SyntheticEvent | MouseEvent | KeyboardEvent | undefined | null;

function isPlainObject(v: unknown): v is Record<string, any> {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isTriggerOptions(v: unknown): v is {
    props?: any;
    uid?: string;
    preventDefault?: boolean;
    stopPropagation?: boolean;
} {
    if (!isPlainObject(v)) return false;

    const allowed = new Set(['props', 'uid', 'preventDefault', 'stopPropagation']);
    const keys = Object.keys(v);
    if (keys.length === 0) return false;

    for (const k of keys) {
        if (!allowed.has(k)) return false;
    }
    return true;
}

function safePreventDefault(e: any) {
    try {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
    } catch {}
}

function safeStopPropagation(e: any) {
    try {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    } catch {}
}

export const DialogProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const store = getDialogStore();

    const [loading, setLoading] = React.useState(false);
    const [alerts, setAlerts] = React.useState<ConfirmEntry[]>([]);
    const [popups, setPopups] = React.useState<PopupEntry[]>([]);
    const rects = useLivePopupRects(popups);

    function pushAlert(content?: React.ReactNode | ContentOverride, onAccept?: () => void, onReject?: () => void) {
        const base = coerceMessage(content, 'Are you sure?');
        return new Promise<boolean>((resolve) => {
            const id = newId('alert');
            setAlerts((prev) => prev.concat([{ id, ...base, onAccept, onReject, resolve, open: true }]));
        });
    }

    function coerceAnchor(anchorLike: HTMLElement | MouseEvent | { current?: HTMLElement | null } | null | undefined): HTMLElement {
        if (!anchorLike) return document.body;
        if (anchorLike instanceof MouseEvent) return (anchorLike.currentTarget as HTMLElement) ?? document.body;
        if (anchorLike instanceof HTMLElement) return anchorLike;
        // @ts-ignore
        if (anchorLike && 'current' in anchorLike) return anchorLike.current ?? document.body;
        return document.body;
    }

    function pushPopup(
        anchorLike: HTMLElement | MouseEvent | { current?: HTMLElement | null } | React.MouseEvent<HTMLElement>,
        content?: React.ReactNode | ContentOverride,
        onAccept?: () => void,
        onReject?: () => void
    ) {
        const el = coerceAnchor(anchorLike as any);
        const base = coerceMessage(content, 'Are you sure?');
        return new Promise<boolean>((resolve) => {
            const id = newId('popup');
            setPopups((prev) =>
                prev.concat([
                    {
                        id,
                        ...base,
                        onAccept,
                        onReject,
                        resolve,
                        open: true,
                        anchor: el,
                        side: 'bottom',
                        align: 'center',
                    },
                ])
            );
        });
    }

    const ctx = React.useMemo<DialogContextValue>(
        () => ({
            // @ts-ignore
            open(idOrComp, props, uid) {
                return store.open(idOrComp as any, props, uid);
            },
            update(idOrComp, props, uid) {
                store.update(idOrComp as any, props, uid);
            },
            hide(idOrComp, uid) {
                store.hide(idOrComp as any, uid);
            },
            close(idOrComp, uid) {
                store.close(idOrComp as any, uid);
            },

            // @ts-ignore
            trigger(idOrComp, a, b, c) {
                const asOpts = isTriggerOptions(a);
                const opts = (asOpts ? (a ?? {}) : (c ?? {})) as any;
                const propsArg = asOpts ? undefined : a;
                const uidArg = asOpts ? undefined : b;

                const preventDefault = opts.preventDefault ?? false;
                const stopPropagation = opts.stopPropagation ?? false;

                return (e?: TriggerEvent) => {
                    if (preventDefault) safePreventDefault(e);
                    if (stopPropagation) safeStopPropagation(e);

                    const uid = (opts.uid ?? uidArg) as string | undefined;
                    const rawProps = opts.props ?? propsArg;
                    const props = typeof rawProps === 'function' ? (rawProps as any)(e) : rawProps;

                    store.open(idOrComp as any, props, uid);
                };
            },

            confirm: (c, a, r) => pushAlert(c, a, r),
            del: (c, a, r) => pushAlert(c ?? 'Do you want to delete this record?', a, r),

            popup(anchor) {
                return {
                    confirm: (c, a, r) => pushPopup(anchor as any, c, a, r),
                    del: (c, a, r) => pushPopup(anchor as any, c ?? 'Do you want to delete this record?', a, r),
                };
            },

            loader: (show) => setLoading(show),
            error: (content) => {
                console.error('[dialog.error]', content);
            },

            _register(ctrl) {
                store.register(ctrl as any);
            },
            _unregister(id, uid) {
                store.unregister(id, uid);
            },
        }),
        [store]
    );

    return (
        <DialogCtx.Provider value={ctx}>
            {children}

            {/* Loader overlay */}
            {loading && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 backdrop-blur-[2px]">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            {/* Alert dialogs */}
            {alerts.map((entry) => (
                <AlertDialog
                    key={entry.id}
                    open={entry.open}
                    onOpenChange={(o) => {
                        if (!o) {
                            entry.onReject?.();
                            entry.resolve(false);
                            setAlerts((prev) => prev.filter((x) => x.id !== entry.id));
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{entry.title ?? 'Confirmation'}</AlertDialogTitle>
                        </AlertDialogHeader>
                        <div className="text-sm text-muted-foreground">{entry.content}</div>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => {
                                    entry.onReject?.();
                                    entry.resolve(false);
                                    setAlerts((prev) => prev.filter((x) => x.id !== entry.id));
                                }}
                            >
                                {entry.cancelLabel ?? 'Cancel'}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    entry.onAccept?.();
                                    entry.resolve(true);
                                    setAlerts((prev) => prev.filter((x) => x.id !== entry.id));
                                }}
                            >
                                {entry.acceptLabel ?? 'Continue'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ))}

            {/* Popovers */}
            {popups.map((entry) => {
                const r = rects[entry.id] ?? entry.anchor.getBoundingClientRect();
                const style: React.CSSProperties = {
                    position: 'fixed',
                    left: r.left + r.width / 2,
                    top: r.top + r.height / 2,
                    width: 1,
                    height: 1,
                    pointerEvents: 'none',
                };
                return (
                    <Popover.Root
                        key={entry.id}
                        open={entry.open}
                        onOpenChange={(o) => {
                            if (!o) {
                                entry.onReject?.();
                                entry.resolve(false);
                                setPopups((prev) => prev.filter((x) => x.id !== entry.id));
                            }
                        }}
                    >
                        <Popover.Anchor asChild>
                            <span style={style} />
                        </Popover.Anchor>
                        <Popover.Content
                            side={entry.side}
                            align={entry.align}
                            sideOffset={8}
                            className="z-50 w-64 rounded-xl border bg-popover p-4 shadow-lg text-popover-foreground text-xs leading-normal animate-in fade-in-0 zoom-in-95"
                        >
                            {entry.title && <div className="mb-1 font-semibold text-sm">{entry.title}</div>}
                            <div className="mb-4 text-muted-foreground">{entry.content}</div>
                            <div className="flex justify-end gap-2">
                                <button
                                    className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold bg-background hover:bg-muted hover:cursor-pointer transition-colors"
                                    onClick={() => {
                                        entry.onReject?.();
                                        entry.resolve(false);
                                        setPopups((prev) => prev.filter((x) => x.id !== entry.id));
                                    }}
                                >
                                    {entry.cancelLabel ?? 'Cancel'}
                                </button>
                                <button
                                    className="text-primary-foreground inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/95 hover:cursor-pointer transition-colors"
                                    onClick={() => {
                                        entry.onAccept?.();
                                        entry.resolve(true);
                                        setPopups((prev) => prev.filter((x) => x.id !== entry.id));
                                    }}
                                >
                                    {entry.acceptLabel ?? 'Continue'}
                                </button>
                            </div>
                        </Popover.Content>
                    </Popover.Root>
                );
            })}
        </DialogCtx.Provider>
    );
};
DialogProvider.displayName = 'DialogProvider';

