/* eslint-disable -- Timeax registry source retained for createDialog compatibility. */
import { HeadlessResponsiveDialog, type DrawerSide, type DrawerSize } from '@/components/ui/headless-responsive-dialog';
import * as React from 'react';
import { useDialog } from './dialog-provider';
import type { DialogController, ModalAttachedProps, ModalComponent, DialogLayoutContextValue } from './dialog-manager.types';

export const DialogParentContext = React.createContext<DialogLayoutContextValue | null>(null);

type ModalLayoutOverrides = {
    /** Switch to drawer when viewport ≤ this breakpoint (px). If undefined, stays modal. */
    drawerAt?: number;
    /** Drawer options when drawerAt matches */
    drawerSide?: DrawerSide;
    drawerSize?: DrawerSize;
    maxVh?: number;
    outsideClosable?: boolean;
};

export function createDialog<TProps, TResult = unknown>(
    id: string,
    render: (ctx: {
        props: TProps;
        hide: (resolve?: boolean, data?: TResult) => void;
        open: boolean;
        setData: (d: unknown) => void;
    }) => React.ReactNode
): ModalComponent<TProps & ModalLayoutOverrides, TResult> {
    const Comp: React.FC<ModalAttachedProps<TProps & ModalLayoutOverrides, TResult>> = (p) => {
        const {
            title,
            className,
            uid,
            outsideClosable,
            promise,
            onClose,
            headless,
            contentClassName,
            scrollbarClassName,
            drawerAt,
            drawerSide,
            drawerSize,
            maxVh,
            ...rest
        } = p;

        const [open, setOpen] = React.useState(false);
        const [merged, setMerged] = React.useState<TProps & { onDialogClose?(): void }>(rest as any);
        const dataRef = React.useRef<unknown>(undefined);
        const dialog = useDialog();

        const displayedTitle = React.useMemo(() => (merged as any).title ?? title, [(merged as any).title, title]);
        const ctrlRef = React.useRef<DialogController<TResult, TProps> | null>(null);

        const ctrl: DialogController<TResult, TProps> = React.useMemo(() => {
            const c: DialogController<TResult, TProps> = {
                id,
                uid,
                open: (next?: Partial<TProps>) => {
                    if (next) {
                        setMerged((m) => ({ ...m, ...next }));
                    }
                    setOpen(true);

                    if (promise) {
                        return new Promise<TResult>((resolve, reject) => {
                            c.hide = (ok?: boolean) => {
                                setOpen(false);
                                onClose?.({
                                    resolved: !!ok,
                                    data: dataRef.current as TResult,
                                });
                                ok ? resolve((dataRef.current as TResult) ?? (undefined as any)) : reject('cancelled');
                            };
                        });
                    }
                },
                update: (next) => setMerged((m) => ({ ...m, ...next })),
                hide: (ok) => {
                    setOpen(false);
                    merged.onDialogClose?.();
                    onClose?.({ resolved: !!ok, data: dataRef.current as TResult });
                },
                setData: (d) => {
                    dataRef.current = d;
                },
                get data() {
                    return dataRef.current;
                },
            };

            return c;
        }, [uid, promise, onClose, merged.onDialogClose]);

        React.useEffect(() => {
            ctrlRef.current = ctrl;
            dialog._register(ctrl);
            return () => {
                dialog._unregister(id, uid);
            };
        }, [ctrl, dialog, uid]);

        const hide = React.useCallback(
            (ok?: boolean, data?: TResult) => {
                if (data !== undefined) {
                    ctrl.setData(data);
                }
                ctrl.hide(!!ok);
            },
            [ctrl]
        );

        const renderResult = render({ props: merged, hide, setData: ctrl.setData, open });

        let isCustomLayout = false;
        if (React.isValidElement(renderResult)) {
            let type: any = renderResult.type;
            while (type && typeof type === 'object' && 'type' in type) {
                type = type.type;
            }
            isCustomLayout = type?.displayName === 'DialogWrapper' || type?.name === 'DialogWrapper';
        }

        return (
            <DialogParentContext.Provider value={{ title: displayedTitle, open, close: () => hide(false) }}>
                <HeadlessResponsiveDialog
                    open={open}
                    scrollbarClassName={scrollbarClassName}
                    onOpenChange={(o) => (!o ? hide(false) : void 0)}
                    title={displayedTitle}
                    description={undefined}
                    contentClassName={contentClassName}
                    className={className}
                    drawerAt={drawerAt}
                    drawerSide={drawerSide}
                    drawerSize={drawerSize}
                    maxVh={maxVh}
                    outsideClosable={outsideClosable}
                    escapeClosable={true}
                    headless={isCustomLayout ? true : headless}
                >
                    {renderResult}
                </HeadlessResponsiveDialog>
            </DialogParentContext.Provider>
        );
    };

    (Comp as ModalComponent<TProps & ModalLayoutOverrides, TResult>).id = id;
    return Comp as ModalComponent<TProps & ModalLayoutOverrides, TResult>;
}

// Support the alias createModal to maintain full backwards compatibility with source files
export const createModal = createDialog;


