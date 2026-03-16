import type { FieldNode, OptionNode, TagNode } from '@timeax/digital-service-engine/core';

type PricingRole = 'base' | 'utility';

export type ServiceCapability = {
    canEdit: boolean;
    message?: string;
};

export type TriggerMappingCapability = {
    canEdit: boolean;
    message?: string;
};

export type QuantityCapability = {
    canEditRule: boolean;
    canEditDefault: boolean;
    ruleHelp?: string;
    defaultHelp?: string;
};

export type FieldPropertyCapabilities = {
    kind: 'field';
    role: PricingRole;
    hasOptions: boolean;
    isUtility: boolean;
    isButton: boolean;
    buttonModeLocked: boolean;
    buttonModeMessage?: string;
    service: ServiceCapability;
    triggerMappings: TriggerMappingCapability;
    quantity: QuantityCapability;
    utility: { canEdit: true };
};

export type OptionPropertyCapabilities = {
    kind: 'option';
    role: PricingRole;
    isUtility: boolean;
    service: ServiceCapability;
    triggerMappings: TriggerMappingCapability;
    quantity: QuantityCapability;
    utility: { canEdit: true };
};

export type TagPropertyCapabilities = {
    kind: 'tag';
    service: ServiceCapability;
    triggerMappings: TriggerMappingCapability;
    quantity: QuantityCapability;
    utility: { canEdit: false };
};

export type NodePropertyCapabilities = FieldPropertyCapabilities | OptionPropertyCapabilities | TagPropertyCapabilities;

export function getFieldPropertyCapabilities(node: FieldNode): FieldPropertyCapabilities {
    const hasOptions = (node.raw.options?.length ?? 0) > 0;
    const role = normalizeRole(node.raw.pricing_role);
    const isUtility = role === 'utility';
    const isButton = hasOptions || Boolean(node.raw.button);
    let service: ServiceCapability = { canEdit: true };
    let triggerMappings: TriggerMappingCapability = { canEdit: true };

    if (hasOptions) {
        service = {
            canEdit: false,
            message: 'This field is an option container. Connect services on its options instead.',
        };
        triggerMappings = {
            canEdit: false,
            message: 'This field is an option container. Trigger include/exclude mappings belong on its options instead.',
        };
    } else if (!isButton) {
        service = {
            canEdit: false,
            message: 'Only button fields can anchor base services.',
        };
        triggerMappings = {
            canEdit: false,
            message: 'Only button fields can drive include/exclude mappings.',
        };
    } else if (isUtility) {
        service = {
            canEdit: false,
            message: 'Utility fields add extra charges and cannot anchor base services.',
        };
    }

    return {
        kind: 'field',
        role,
        hasOptions,
        isUtility,
        isButton,
        buttonModeLocked: hasOptions,
        buttonModeMessage: hasOptions ? 'Fields with options are always button-style containers.' : undefined,
        service,
        triggerMappings,
        quantity: {
            canEditRule: true,
            canEditDefault: isButton,
            ruleHelp: 'Field rules resolve the runtime snapshot quantity. The first visible field rule wins.',
            defaultHelp: isButton ? 'This button-style field seeds a default quantity when no field rule wins.' : undefined,
        },
        utility: { canEdit: true },
    };
}

export function getOptionPropertyCapabilities(node: OptionNode): OptionPropertyCapabilities {
    const role = normalizeRole(node.raw.pricing_role ?? node.field().raw.pricing_role);
    const isUtility = role === 'utility';

    return {
        kind: 'option',
        role,
        isUtility,
        service: {
            canEdit: !isUtility,
            message: isUtility ? 'Utility-priced options add extra charges and cannot connect to services.' : undefined,
        },
        triggerMappings: { canEdit: true },
        quantity: {
            canEditRule: false,
            canEditDefault: true,
            defaultHelp: 'This option only seeds a default quantity. It does not resolve runtime quantity.',
        },
        utility: { canEdit: true },
    };
}

export function getTagPropertyCapabilities(): TagPropertyCapabilities {
    return {
        kind: 'tag',
        service: { canEdit: true },
        triggerMappings: { canEdit: true },
        quantity: {
            canEditRule: false,
            canEditDefault: true,
            defaultHelp: 'This tag only seeds a default quantity. It does not resolve runtime quantity.',
        },
        utility: { canEdit: false },
    };
}

export function getNodePropertyCapabilities(node: TagNode | FieldNode | OptionNode): NodePropertyCapabilities {
    if (node.kind === 'field') return getFieldPropertyCapabilities(node);
    if (node.kind === 'option') return getOptionPropertyCapabilities(node);
    return getTagPropertyCapabilities();
}

function normalizeRole(value: unknown): PricingRole {
    return value === 'utility' ? 'utility' : 'base';
}
