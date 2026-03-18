import type { Tag } from '@timeax/digital-service-engine';
import { IoClose } from 'react-icons/io5';

export type TagNotice = {
    id: string;
    title: string;
    severity: 'info' | 'warning' | 'error';
    color?: string;
};

function noticeToneClass(notice: TagNotice) {
    const color = (notice.color ?? '').toLowerCase();

    if (color.includes('red') || color.includes('rose') || color.includes('danger')) {
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    }
    if (color.includes('amber') || color.includes('yellow') || color.includes('orange') || color.includes('warning')) {
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
    if (color.includes('green') || color.includes('success')) {
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    }
    if (color.includes('blue') || color.includes('info') || color.includes('primary')) {
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }

    if (notice.severity === 'error') {
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    }
    if (notice.severity === 'warning') {
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
}

type TagsWidgetProps = {
    visibleTag: Tag | null;
    parents: Tag[];
    children: Tag[];
    noticesByTagId: Map<string, TagNotice[]>;
    onSelect: (id: string) => void;
};

export function WireframeTagsWidget({ visibleTag, parents, children, noticesByTagId, onSelect }: TagsWidgetProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <small className="shrink-0 cursor-pointer text-sm font-medium text-gray-500 dark:text-gray-400" onClick={() => onSelect('t:root')}>
                Tags:
            </small>
            <div className="flex flex-wrap items-center gap-1.5">
                {visibleTag ? (
                    <>
                        {parents.map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                onClick={() => onSelect(item.id)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 py-1 pr-1.5 pl-2.5 text-xs text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                <span>{item.label}</span>
                                {(noticesByTagId.get(item.id) ?? []).map((notice) => (
                                    <span key={notice.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${noticeToneClass(notice)}`}>
                                        {notice.title}
                                    </span>
                                ))}
                                <span
                                    onClick={() => onSelect(item.bind_id ?? 't:root')}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-500 hover:bg-gray-300 dark:text-gray-400 dark:hover:bg-gray-700"
                                >
                                    <IoClose className="text-[11px]" />
                                </span>
                            </button>
                        ))}

                        <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gray-100 py-1 pr-1.5 pl-2.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            <span>{visibleTag.label}</span>
                            {(noticesByTagId.get(visibleTag.id) ?? []).map((notice) => (
                                <span key={notice.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${noticeToneClass(notice)}`}>
                                    {notice.title}
                                </span>
                            ))}
                            <span
                                onClick={() => onSelect(visibleTag.bind_id ?? 't:root')}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-500 hover:bg-gray-300 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                                <IoClose className="text-[11px]" />
                            </span>
                        </button>

                        {children.map((item) => {
                            return (
                                <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => onSelect(item.id)}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 py-1 pr-1.5 pl-2.5 text-xs text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    <span>{item.label}</span>
                                    {(noticesByTagId.get(item.id) ?? []).map((notice) => (
                                        <span
                                            key={notice.id}
                                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${noticeToneClass(notice)}`}
                                        >
                                            {notice.title}
                                        </span>
                                    ))}
                                </button>
                            );
                        })}
                    </>
                ) : children.length ? (
                    children.map((item) => {
                        return (
                            <button
                                type="button"
                                key={item.id}
                                onClick={() => onSelect(item.id)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 py-1 pr-1.5 pl-2.5 text-xs text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                <span>{item.label}</span>
                                {(noticesByTagId.get(item.id) ?? []).map((notice) => (
                                    <span key={notice.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${noticeToneClass(notice)}`}>
                                        {notice.title}
                                    </span>
                                ))}
                            </button>
                        );
                    })
                ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">No tags available</span>
                )}
            </div>
        </div>
    );
}

export default WireframeTagsWidget;
