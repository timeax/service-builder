import type { Collision, CollisionDetection } from '@dnd-kit/core';
import { pointerWithin, rectIntersection } from '@dnd-kit/core';
import { parseZoneId } from '../dnd-ids';

/**
 * Prefer droppable directly under pointer, then:
 *  - nearest to row center vertically
 *  - zone priority: ON > BEFORE > AFTER
 *  - shallower depth if still tied
 * Also remembers winner so dragEnd has a target if evt.over is null.
 */
export function buildCollisionDetection(): CollisionDetection {
    return (args) => {
        const primary = pointerWithin(args);
        const base = primary.length ? primary : rectIntersection(args);
        const { droppableRects, pointerCoordinates } = args;
        if (!pointerCoordinates || base.length === 0) return base;

        const scored = base
            .map(({ id }) => {
                const rect = droppableRects.get(id);
                if (!rect) return null;

                const centerY = rect.top + rect.height / 2;
                const dy = Math.abs(pointerCoordinates.y - centerY);

                const parsed = parseZoneId(String(id));
                const zone = parsed?.zone ?? 'on';
                const priority = zone === 'on' ? 0 : zone === 'before' ? 1 : 2;
                const depth = parsed?.path.length ?? 0;

                return { id, dy, priority, depth };
            })
            .filter(Boolean) as Array<{ id: string | symbol; dy: number; priority: number; depth: number }>;

        scored.sort((a, b) => a.dy - b.dy || a.priority - b.priority || a.depth - b.depth);
        const winner = scored[0];
        return winner ? ([{ id: winner.id }] as Collision[]) : [];
    };
}
