import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import React from 'react';

interface ConstraintOriginPopoverProps {
    constraint: string;
    onClearSelf: () => void;
    onClearSubtree: () => void;
}

export function ConstraintOriginPopover({ constraint, onClearSelf, onClearSubtree }: ConstraintOriginPopoverProps) {
    return (
        <Popover>
            <PopoverTrigger className={'flex items-center gap-1'}>Owner</PopoverTrigger>

            <PopoverContent className={'w-fit p-0'}>
                <div className={'max-w-[320px] p-3 text-sm'}>
                    <div className={'font-medium'}>Clear constraint?</div>

                    <div className={'mt-1 text-muted-foreground'}>
                        You&apos;re about to clear <span className={'font-medium'}>{constraint}</span> on this tag. Descendants may inherit a different
                        value (or none) after this change.
                    </div>

                    <div className={'mt-3 space-y-2'}>
                        <div className={'text-muted-foreground'}>Do you want to also clear it for the whole subtree (â€œshake the treeâ€)?</div>

                        <div className={'flex items-center justify-end gap-2'}>
                            <button
                                type={'button'}
                                className={'inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted'}
                                onClick={onClearSelf}
                            >
                                Just this tag
                            </button>

                            <button
                                type={'button'}
                                className={'inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted'}
                                onClick={onClearSubtree}
                            >
                                Clear subtree
                            </button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
