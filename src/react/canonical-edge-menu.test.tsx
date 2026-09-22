// SPDX-License-Identifier: GPL-3.0-only
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalEdgeMenu } from './canonical-canvas-surface';

describe('canonical edge menu', () => {
    it('routes relationship changes and disconnects through explicit commands', () => {
        const onChange = vi.fn();
        const onDisconnect = vi.fn();
        render(
            <CanonicalEdgeMenu
                relation={{ kind: 'bind', from: 'filter:platform', to: 'field:service' }}
                position={{ x: 120, y: 80 }}
                can_edit
                on_change={onChange}
                on_disconnect={onDisconnect}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Change to exclude' }));
        expect(onChange).toHaveBeenCalledWith('exclude');
        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
        expect(onDisconnect).toHaveBeenCalledOnce();
    });

    it('keeps denied relationship actions visible, disabled, and explained', () => {
        const onChange = vi.fn();
        const onDisconnect = vi.fn();
        render(
            <CanonicalEdgeMenu
                relation={{ kind: 'include', from: 'option:service', to: 'field:url' }}
                position={{ x: 120, y: 80 }}
                can_edit={false}
                disabled_reason="Editing is disabled for this actor."
                on_change={onChange}
                on_disconnect={onDisconnect}
            />,
        );

        const change = screen.getByRole('button', { name: 'Change to exclude' });
        const disconnect = screen.getByRole('button', { name: 'Disconnect' });
        expect(change).toBeDisabled();
        expect(change).toHaveAttribute('title', 'Editing is disabled for this actor.');
        expect(disconnect).toBeDisabled();
        expect(disconnect).toHaveAttribute('title', 'Editing is disabled for this actor.');
        fireEvent.click(change);
        fireEvent.click(disconnect);
        expect(onChange).not.toHaveBeenCalled();
        expect(onDisconnect).not.toHaveBeenCalled();
    });
});
