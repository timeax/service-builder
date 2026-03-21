import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import RightPanel from './index.tsx';

const selectRootOnMount = vi.fn();

vi.mock('@/components/ui/panel.tsx', () => ({
    Panel: ({ children, edges, resizable, defaultWidth, defaultHeight, minWidth, minHeight, maxWidth, maxHeight, ...props }: PropsWithChildren<Record<string, unknown>>) => (
        <div {...props}>{children}</div>
    ),
}));

vi.mock('@/panels/right/components/header.tsx', () => ({
    default: () => <div>Header</div>,
}));

vi.mock('@/panels/right/tabs/comments.tsx', () => ({
    default: () => <div>Comments Content</div>,
}));

vi.mock('@/panels/right/tabs/properties.tsx', () => ({
    Properties: () => <div>Properties Content</div>,
}));

vi.mock('@/panels/right/tabs/wireframe.tsx', () => ({
    default: () => <div>Wireframe Content</div>,
}));

vi.mock('@timeax/digital-service-engine/workspace', () => ({
    useCanvas: () => ({
        props: {},
        api: {
            builder: {},
            selection: {
                selectRoot: selectRootOnMount,
            },
        },
    }),
}));

vi.mock('@timeax/digital-service-engine/react', () => ({
    useInputs: () => ({ registry: {} }),
    OrderFlowProvider: ({ children, selection }: PropsWithChildren<{ selection?: { selectRoot?: (id: string) => void } }>) => {
        useEffect(() => {
            selection?.selectRoot?.('t:root');
        }, [selection]);

        return <>{children}</>;
    },
}));

describe('RightPanel wireframe tab behavior', () => {
    it('does not remount wireframe provider when toggling tabs repeatedly', async () => {
        selectRootOnMount.mockClear();

        render(<RightPanel />);

        await waitFor(() => expect(selectRootOnMount).toHaveBeenCalledTimes(1));

        const commentsTab = screen.getByRole('tab', { name: 'Comments' });
        const propertiesTab = screen.getByRole('tab', { name: 'Properties' });
        const wireframeTab = screen.getByRole('tab', { name: 'Wireframe' });

        for (let i = 0; i < 3; i += 1) {
            fireEvent.click(commentsTab);
            fireEvent.click(wireframeTab);
            fireEvent.click(propertiesTab);
            fireEvent.click(wireframeTab);
        }

        expect(selectRootOnMount).toHaveBeenCalledTimes(1);
    });
});
