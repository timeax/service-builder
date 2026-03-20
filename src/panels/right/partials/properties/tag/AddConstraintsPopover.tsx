import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { RenderIf } from '@/panels/right/components/renderif.tsx';
import { SectionActionTriggerButton } from '@/panels/right/components/sections.tsx';
import { Form, InputField } from '@timeax/form-palette';
import React from 'react';
import { BsPlus } from 'react-icons/bs';

interface AddConstraintsPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    constraints: string[];
    allConstraints: unknown[];
    onSubmit: (data: Record<string, unknown>) => void;
}

export function AddConstraintsPopover({ open, onOpenChange, constraints, allConstraints, onSubmit }: AddConstraintsPopoverProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <SectionActionTriggerButton icon={<BsPlus />}>Add</SectionActionTriggerButton>
            </PopoverTrigger>
            <PopoverContent>
                <RenderIf data={allConstraints}>
                    <Form
                        wrapped
                        gap={12}
                        onSubmit={(e) => {
                            onSubmit(e.formData);
                            onOpenChange(false);
                        }}
                    >
                        <InputField
                            name={'constraints'}
                            variant={'checkbox'}
                            defaultValue={constraints.map((item) => ({ state: true, value: item })) as any}
                            optGroupClassName={'gap-2'}
                            tristate
                            autoCap
                            options={allConstraints as any}
                        />

                        <Button type={'submit'} size={'sm'}>
                            Save
                        </Button>
                    </Form>
                </RenderIf>
            </PopoverContent>
        </Popover>
    );
}
