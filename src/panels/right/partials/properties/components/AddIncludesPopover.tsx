import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import { InputField } from '@timeax/form-palette';
import { useState } from 'react';
import { BsPlus } from 'react-icons/bs';

interface AddIncludesPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    options: unknown[];
    onSelect(value: string[]): void;
}

export function AddIncludesPopover({ open, onOpenChange, onSelect, options }: AddIncludesPopoverProps) {
    const [value, setValue] = useState<any>();

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <SectionActionTriggerButton icon={<BsPlus />}>Add</SectionActionTriggerButton>
            </PopoverTrigger>
            <PopoverContent>
                <div className={'flex flex-col gap-2'}>
                    <InputField
                        value={value}
                        onChange={(e) => {
                            setValue(e.value);
                        }}
                        optGroupClassName={'gap-4'}
                        variant={'checkbox'}
                        options={options as any}
                    />
                    <Button
                        onClick={() => {
                            onSelect(value);
                            setValue(undefined);
                            onOpenChange(false);
                        }}
                        type={'submit'}
                        size={'sm'}
                    >
                        Save
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
