import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { AlertTriangle } from 'lucide-react';
import React from 'react';

interface ConstraintOverridePopoverProps {
    constraint: string;
    onClear: () => void;
}

export function ConstraintOverridePopover({ constraint, onClear }: ConstraintOverridePopoverProps) {
    return (
        <Popover>
            <PopoverTrigger className={'flex items-center gap-1'}>
                <AlertTriangle className="size-3 text-yellow-400" />
                Overridden
            </PopoverTrigger>

            <PopoverContent className={'w-fit p-0'}>
                <div className={'max-w-[320px] p-3 text-sm'}>
                    <div className={'font-medium'}>Constraint override detected</div>

                    <div className={'mt-1 text-muted-foreground'}>
                        This tag tries to set <span className={'font-medium'}>{constraint}</span>, but an ancestor tag already decided it. Overrides
                        don&apos;t apply â€” the ancestor value wins.
                    </div>

                    <div className={'mt-3 space-y-1'}>
                        <div className={'font-medium'}>How to fix</div>
                        <ul className={'list-disc pl-4 text-muted-foreground'}>
                            <li>
                                Click <span className={'font-medium'}>Origin</span> to jump to the ancestor that set the rule, then make the value match
                                there (or remove it).
                            </li>
                            <li>If you need different rules, create a new tag group instead of nesting under this one.</li>
                        </ul>
                    </div>

                    <div className={'mt-3 flex items-center justify-end'}>
                        <button
                            type={'button'}
                            className={'inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted'}
                            onClick={onClear}
                        >
                            Clear override
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
