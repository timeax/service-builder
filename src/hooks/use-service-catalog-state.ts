import type { ServiceCatalogState } from '@timeax/digital-service-engine/schema';
import { useEffect, useState } from 'react';

type CatalogAwareEditor = {
    getCatalog?: () => ServiceCatalogState | null | undefined;
    ensureCatalog?: () => ServiceCatalogState | null | undefined;
};

type CatalogAwareCanvasApi = {
    on: (
        event: any,
        handler: (payload: { catalog?: ServiceCatalogState } | undefined) => void,
    ) => undefined | null | (() => void);
};

export function useServiceCatalogState(canvasApi: CatalogAwareCanvasApi, editor: CatalogAwareEditor): ServiceCatalogState | null {
    const [catalogState, setCatalogState] = useState<ServiceCatalogState | null>(null);

    useEffect(() => {
        const resolveCatalog = (catalog?: ServiceCatalogState) => catalog ?? editor.getCatalog?.() ?? editor.ensureCatalog?.() ?? null;

        setCatalogState(resolveCatalog());

        const offCatalogChange = canvasApi.on('catalog:change' as any, (payload) => {
            setCatalogState(resolveCatalog(payload?.catalog));
        });
        const offCatalogActiveChange = canvasApi.on('catalog:active-change' as any, () => {
            setCatalogState(resolveCatalog());
        });

        return () => {
            offCatalogChange?.();
            offCatalogActiveChange?.();
        };
    }, [canvasApi, editor]);

    return catalogState;
}
