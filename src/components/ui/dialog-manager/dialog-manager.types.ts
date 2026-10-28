/* eslint-disable -- Timeax registry source retained for createDialog compatibility. */
import * as React from 'react';

export type DialogController<TResult = unknown, TProps = unknown> = {
    id: string;
    uid?: string;
    open: (props?: Partial<TProps>) => Promise<TResult> | void;
    update: (props: Partial<TProps>) => void;
    hide: (resolve?: boolean) => void;
    setData: (data: unknown) => void;
    readonly data: unknown;
};

export type ModalComponent<TProps, TResult> = React.FC<ModalAttachedProps<TProps, TResult>> & { id: string };

export type ModalAttachedProps<TProps, TResult> = {
    title?: React.ReactNode | string;
    className?: string;
    contentClassName?: string;
    scrollbarClassName?: string;
    outsideClosable?: boolean;
    headless?: boolean;
    uid?: string;
    promise?: boolean;
    onClose?(result?: { resolved: boolean; data?: TResult }): void;
} & TProps;

export type ContentOverride = {
    content?: React.ReactNode;
    title?: React.ReactNode;
    acceptLabel?: React.ReactNode;
    cancelLabel?: React.ReactNode;
};

export type ConfirmPopupCallback = (
    content?: React.ReactNode | ContentOverride,
    accept?: () => void,
    reject?: () => void
) => Promise<boolean>;

export type DialogContextValue = {
    open<TResult = unknown, TProps = any>(
        idOrComp: string | ModalComponent<TProps, TResult>,
        props?: Partial<TProps & { onDialogClose?(): void }>,
        uid?: string
    ): Promise<TResult> | undefined;

    update<TProps = unknown>(
        idOrComp: string | ModalComponent<TProps, unknown>,
        props: Partial<TProps>,
        uid?: string
    ): void;

    hide(idOrComp: string | { id: string }, uid?: string): void;
    close(idOrComp: string | { id: string }, uid?: string): void;

    confirm: ConfirmPopupCallback;
    del: ConfirmPopupCallback;

    popup(anchor: HTMLElement | { current?: HTMLElement | null } | MouseEvent | React.MouseEvent<HTMLElement>): {
        confirm: ConfirmPopupCallback;
        del: ConfirmPopupCallback;
    };

    loader(show: boolean): void;
    error(content: React.ReactNode, opts?: { title?: string }): void;

    trigger<TResult = unknown, TProps = unknown>(
        idOrComp: string | ModalComponent<TProps, TResult>,
        props?: Partial<TProps>,
        uid?: string,
        opts?: Omit<DialogTriggerOptions<TProps>, 'props' | 'uid'>
    ): DialogTriggerHandler;

    trigger<TResult = unknown, TProps = unknown>(
        idOrComp: string | ModalComponent<TProps, TResult>,
        opts?: DialogTriggerOptions<TProps>
    ): DialogTriggerHandler;

    _register(ctrl: DialogController<any, any>): void;
    _unregister(id: string, uid?: string): void;
};

export type DialogTriggerOptions<TProps> = {
    props?: Partial<TProps & { onDialogClose?(): void }>;
    uid?: string;
    preventDefault?: boolean;
    stopPropagation?: boolean;
};

export type DialogTriggerHandler = (e?: React.MouseEvent<HTMLElement> | MouseEvent | React.SyntheticEvent) => void;

/* ─────────────────────────────────────────────
 * Compound Layout Context & Types
 * ───────────────────────────────────────────── */

export type DialogLayoutContextValue = {
    title?: React.ReactNode;
    open: boolean;
    close: () => void;
};

export type DialogWrapperProps = React.ComponentPropsWithoutRef<'div'>;

export type DialogHeaderProps = React.ComponentPropsWithoutRef<'div'>;

export type DialogContentProps = {
    children?: React.ReactNode;
    /** Classes applied to the outer sizing container (flex-1 etc) */
    className?: string;
    /** Classes applied to the inner padding wrapper */
    innerClassName?: string;
};

export type DialogFooterProps = React.ComponentPropsWithoutRef<'div'>;

export type DialogTitleProps = {
    className?: string;
    children?: never;
};

export type DialogCloseProps = {
    className?: string;
    children?: never;
};


