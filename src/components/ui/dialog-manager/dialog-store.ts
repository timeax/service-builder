/* eslint-disable -- Timeax registry source retained for createDialog compatibility. */
import type { DialogController } from './dialog-manager.types';

type AnyCtrl = DialogController<any, any>;

export interface DialogStore {
    map: Map<string, AnyCtrl>;
    keyOf(id: string, uid?: string): string;
    register(ctrl: AnyCtrl): void;
    unregister(id: string, uid?: string): void;
    open(idOrComp: string | { id: string }, props?: unknown, uid?: string): Promise<unknown> | void;
    update(idOrComp: string | { id: string }, props: unknown, uid?: string): void;
    hide(idOrComp: string | { id: string }, uid?: string): void;
    close(idOrComp: string | { id: string }, uid?: string): void;
}

const GLOBAL_KEY = '__dialog_store__';

function createStore(): DialogStore {
    const map = new Map<string, AnyCtrl>();
    const keyOf = (id: string, uid?: string) => (uid ? `${id}::${uid}` : id);

    function resolveId(idOrComp: string | { id: string }) {
        return typeof idOrComp === 'string' ? idOrComp : idOrComp.id;
    }

    return {
        map,
        keyOf,
        register(ctrl) {
            map.set(keyOf(ctrl.id, ctrl.uid), ctrl);
        },
        unregister(id, uid) {
            map.delete(keyOf(id, uid));
        },
        open(idOrComp, props, uid) {
            const id = resolveId(idOrComp);
            return map.get(keyOf(id, uid))?.open(props as any);
        },
        update(idOrComp, props, uid) {
            const id = resolveId(idOrComp);
            map.get(keyOf(id, uid))?.update(props as any);
        },
        hide(idOrComp, uid) {
            const id = resolveId(idOrComp);
            map.get(keyOf(id, uid))?.hide(false);
        },
        close(idOrComp, uid) {
            const id = resolveId(idOrComp);
            map.get(keyOf(id, uid))?.hide(false);
        },
    };
}

export function getDialogStore(): DialogStore {
    const g = globalThis as any;
    if (!g[GLOBAL_KEY]) {
        g[GLOBAL_KEY] = createStore();
    }
    return g[GLOBAL_KEY] as DialogStore;
}

