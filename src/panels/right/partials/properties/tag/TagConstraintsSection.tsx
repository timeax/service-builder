import { RenderIf } from '@/panels/right/components/renderif.tsx';
import { Section } from '@/panels/right/components/sections.tsx';
import { Label } from '@/panels/right/components/text.tsx';
import { type TagNode } from '@timeax/digital-service-engine/core';
import { useCanvas } from '@timeax/digital-service-engine/workspace';
import { InputField } from '@timeax/form-palette';
import { ArrowUpRight } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { TiDelete } from 'react-icons/ti';
import { AddConstraintsPopover } from './AddConstraintsPopover';
import { ConstraintOriginPopover } from './ConstraintOriginPopover';
import { ConstraintOverridePopover } from './ConstraintOverridePopover';

interface TagConstraintsSectionProps {
    node: TagNode;
}

export function TagConstraintsSection({ node }: TagConstraintsSectionProps) {
    const constraints = Object.keys(node.raw.constraints ?? {});
    const canvas = useCanvas();
    const [open, setOpen] = useState(false);
    const allConstraints = useMemo(() => canvas.api.getConstraints() ?? [], [canvas.props]);

    return (
        <>
            <Section>
                <Section.Header>
                    <Section.Title>Constraints</Section.Title>
                    <Section.Actions>
                        <AddConstraintsPopover
                            open={open}
                            onOpenChange={setOpen}
                            constraints={constraints}
                            allConstraints={allConstraints}
                            onSubmit={(data) => {
                                canvas.api.editor.updateTag(node.id, data);
                            }}
                        />
                    </Section.Actions>
                </Section.Header>

                <Section.Content>
                    <RenderIf data={constraints}>
                        {constraints.map((constraint) => {
                            const { id, constraints, constraints_overrides, constraints_origin } = node.raw;

                            const tags: {
                                label: React.ReactNode;
                                icon?: React.ReactNode;
                                className?: string;
                                onClick?: () => void;
                            }[] = [];

                            const ov = constraints_overrides?.[constraint];
                            if (ov) {
                                tags.push({
                                    label: (
                                        <ConstraintOverridePopover
                                            constraint={constraint}
                                            onClear={() => canvas.api.editor.clearConstraintOverride(id, constraint)}
                                        />
                                    ),
                                    className: 'cursor-pointer',
                                });
                            }

                            const originId = constraints_origin?.[constraint] ?? ov?.origin;

                            if (originId) {
                                if (originId !== id) {
                                    tags.push({
                                        label: 'Origin',
                                        icon: <ArrowUpRight className="h-3.5 w-3.5" />,
                                        className: 'cursor-pointer',
                                        onClick: () => canvas.api.select([originId]),
                                    });
                                } else {
                                    tags.push({
                                        label: (
                                            <ConstraintOriginPopover
                                                constraint={constraint}
                                                onClearSelf={() => canvas.api.editor.setConstraint(id, constraint, undefined)}
                                                onClearSubtree={() => canvas.api.editor.clearConstraint(id, constraint)}
                                            />
                                        ),
                                        icon: <TiDelete className="h-3.5 w-3.5" />,
                                        className: 'cursor-pointer',
                                    });
                                }
                            }

                            const value = constraints?.[constraint];

                            return (
                                <InputField
                                    labelPlacement={'left'}
                                    tags={tags as any}
                                    tagClassName={'px-1 cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-50'}
                                    value={value as any}
                                    onChange={(e) => {
                                        canvas.api.editor.setConstraint(id, constraint, e.value);
                                    }}
                                    variant={'toggle'}
                                    label={
                                        <Label variant={'fieldLabel'} className={'capitalize'}>
                                            {constraint}
                                        </Label>
                                    }
                                />
                            );
                        })}
                    </RenderIf>
                </Section.Content>
            </Section>
        </>
    );
}
