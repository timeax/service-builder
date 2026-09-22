import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import { InputField } from '@timeax/form-palette';
import { useState } from 'react';
import { BsPlus } from 'react-icons/bs';

interface AddIncludesPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    options: Array<{ label: string; value: string; description?: string; tags?: Array<{ label: string; value: string }> }>;
    onSelect(value: string[]): void;
}

export function AddIncludesPopover({ open, onOpenChange, onSelect, options }: AddIncludesPopoverProps) {
    const [value, setValue] = useState<string[]>([]);
    const checkboxOptions = options.map((option) => ({
        ...option,
        tags: option.tags?.map((tag) => ({ ...tag, raw: tag.value })),
    }));

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
                            setValue(Array.isArray(e.value) ? e.value.map(String) : e.value == null ? [] : [String(e.value)]);
                        }}
                        optGroupClassName={'gap-4'}
                        variant={'checkbox'}
                        options={checkboxOptions}
                    />
                    <Button
                        onClick={() => {
                            onSelect(value);
                            setValue([]);
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
