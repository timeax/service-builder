// noinspection JSAnnotator
import { Separator } from '@/components/ui/separator.tsx';
import { type TagNode } from '@timeax/digital-service-engine/core';
import { TagConstraintsSection } from './tag/TagConstraintsSection';
import { TagExcludesSection, TagIncludesSection } from './tag/TagIncludesSection';
import AddService from '@/panels/right/partials/global/add-service.tsx';
import QuantitySection from './components/quantity-section.tsx';

export interface TagProps {
    className?: string;
    node: TagNode;
}

export function TagProperties({ node }: TagProps) {
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
            <AddService data={node} />
        </>
    );
}

export default TagProperties;
