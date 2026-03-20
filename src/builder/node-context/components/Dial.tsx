import { DIAL_ACTION_TIMEOUT_MS } from '../types.ts';

export function Dial({ dialActions, dropIntent, dialAnchorStyle, dialRef, emitNodeError, setDropIntent }) {
    return (
        <div
            ref={dialRef}
            className="fixed z-45"
            style={{ left: dialAnchorStyle.left, top: dialAnchorStyle.top, width: dialAnchorStyle.size, height: dialAnchorStyle.size }}
        >
            <div className="absolute inset-0 rounded-full border border-slate-300/80 bg-white/95 shadow-2xl dark:border-slate-700 dark:bg-slate-950/95" />
            <div className="absolute inset-1 rounded-full border border-dashed border-slate-200 dark:border-slate-800" />
            <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                <button
                    type="button"
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                    onClick={() => setDropIntent(null)}
                >
                    Cancel
                </button>
            </div>
            {dialActions.map((action, index) => {
                const angle = (Math.PI * 2 * index) / Math.max(dialActions.length, 1) - Math.PI / 2;
                const radius = 78;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                return (
                    <button
                        key={action.id}
                        type="button"
                        className="absolute left-1/2 top-1/2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                        onClick={async () => {
                            try {
                                await Promise.race([
                                    Promise.resolve(action.execute(dropIntent)),
                                    new Promise((_, reject) => {
                                        window.setTimeout(() => reject(new Error('Drop action timed out')), DIAL_ACTION_TIMEOUT_MS);
                                    }),
                                ]);
                            } catch (error) {
                                emitNodeError((error as Error)?.message ?? 'Drop action failed', {
                                    action: action.id,
                                    receiverId: dropIntent.receiver.nodeId,
                                    source: dropIntent.source.kind,
                                });
                            } finally {
                                setDropIntent(null);
                            }
                        }}
                    >
                        {action.label}
                    </button>
                );
            })}
        </div>
    );
}
