// SPDX-License-Identifier: GPL-3.0-only
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useServiceContextPosition } from './service-context-position';

describe('Service context card position', () => {
    it('previews drag movement locally and writes storage once on release', () => {
        const key = 'service-builder.canvas.system-node.service-context.drag-test';
        window.localStorage.removeItem(key);
        const write = vi.spyOn(Storage.prototype, 'setItem');
        const { result } = renderHook(() => useServiceContextPosition(key));
        act(() => {
            for (let index = 1; index <= 20; index += 1) result.current.onPositionChange({ x: 500 + index, y: -200 + index }, true);
        });
        expect(result.current.position).toEqual({ x: 520, y: -180 });
        expect(write).not.toHaveBeenCalled();
        act(() => result.current.onDragStop({ x: 525, y: -175 }));
        expect(write).toHaveBeenCalledOnce();
        expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual({ x: 525, y: -175 });
        write.mockRestore();
        window.localStorage.removeItem(key);
    });

    it('does not write a no-op drag and drops a pending move on branch change', () => {
        const first = 'service-builder.canvas.system-node.service-context.first';
        const second = 'service-builder.canvas.system-node.service-context.second';
        window.localStorage.removeItem(first);
        window.localStorage.removeItem(second);
        const write = vi.spyOn(Storage.prototype, 'setItem');
        const { result, rerender } = renderHook(({ key }) => useServiceContextPosition(key), { initialProps: { key: first } });
        act(() => result.current.onPositionChange({ x: 501, y: -200 }, true));
        act(() => result.current.onDragStop({ x: 500, y: -200 }));
        expect(write).not.toHaveBeenCalled();
        act(() => result.current.onPositionChange({ x: 510, y: -200 }, true));
        rerender({ key: second });
        act(() => result.current.onDragStop({ x: 510, y: -200 }));
        expect(result.current.position).toEqual({ x: 500, y: -200 });
        expect(write).not.toHaveBeenCalled();
        write.mockRestore();
    });
});
