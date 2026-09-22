export interface DescriptorUiBase {
    type: string;
    label?: string;
    description?: string;
}

export interface DescriptorUiString extends DescriptorUiBase {
    type: 'string';
    enum?: string[];
}

export interface DescriptorUiNumber extends DescriptorUiBase {
    type: 'number';
    minimum?: number;
}

export interface DescriptorUiBoolean extends DescriptorUiBase {
    type: 'boolean';
}

export interface DescriptorUiAnyOf extends DescriptorUiBase {
    type: 'anyOf';
    multiple?: boolean;
    items: Array<{ value: unknown; title?: string; description?: string }>;
}

export interface DescriptorUiObject extends DescriptorUiBase {
    type: 'object';
    fields: Record<string, DescriptorUiSchema>;
    shape?: Record<string, DescriptorUiSchema>;
    order?: string[];
    editable?: boolean;
}

export interface DescriptorUiArray extends DescriptorUiBase {
    type: 'array';
    item?: DescriptorUiSchema;
    items?: DescriptorUiSchema[];
    shape?: Record<string, DescriptorUiSchema>;
    minItems?: number;
    maxItems?: number;
    editable?: boolean;
}

export type DescriptorUiSchema =
    | DescriptorUiString
    | DescriptorUiNumber
    | DescriptorUiBoolean
    | DescriptorUiAnyOf
    | DescriptorUiObject
    | DescriptorUiArray
    | DescriptorUiBase;
