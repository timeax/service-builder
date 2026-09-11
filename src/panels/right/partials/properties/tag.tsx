// noinspection JSAnnotator
import { Separator } from '@/components/ui/separator.tsx';
import AddService from '@/panels/right/partials/global/add-service.tsx';
import { type TagNode } from '@timeax/digital-service-engine/core';
import { getTagPropertyCapabilities } from './components/node-capabilities.ts';
import QuantitySection from './components/quantity-section.tsx';
import ValueEffectsSection from './components/value-effects-section.tsx';
import { TagConstraintsSection } from './tag/TagConstraintsSection';
import { TagExcludesSection, TagIncludesSection } from './tag/TagIncludesSection';

export interface TagProps {
    className?: string;
    node: TagNode;
}

export function TagProperties({ node }: TagProps) {
    const capabilities = getTagPropertyCapabilities();

    return (
        <>
            <TagConstraintsSection node={node} />
            <Separator />
            <QuantitySection node={node} />
            <Separator />
            <TagIncludesSection node={node} />
            <Separator />
            <TagExcludesSection node={node} />
            <Separator />
            <ValueEffectsSection node={node} capability={capabilities.triggerMappings} />
            <Separator />
            <AddService data={node} readOnly={!capabilities.service.canEdit} readOnlyMessage={capabilities.service.message} />
        </>
    );
}

export default TagProperties;
