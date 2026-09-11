import { Button } from '@/components/ui/button.tsx';
import type { Ui, UiArray, UiObject } from '@timeax/digital-service-engine/schema';
import { InputField } from '@timeax/form-palette';
import { useMemo, useState } from 'react';
import { useDescriptorUiRendererRegistry, type DescriptorUiSchema } from './descriptor-ui-renderers.tsx';

type PathSegment = string | number;
type Path = PathSegment[];
type DescriptorUiSchemaMap = Record<string, DescriptorUiSchema>;
type DescriptorUiObjectSchema = Omit<UiObject, 'fields' | 'shape'> & {
    fields: DescriptorUiSchemaMap;
    shape?: DescriptorUiSchemaMap;
};
type DescriptorUiArraySchema = Omit<UiArray, 'item' | 'items' | 'shape'> & {
    item?: DescriptorUiSchema;
    items?: DescriptorUiSchema[];
    shape?: DescriptorUiSchemaMap;
};

const RESERVED_DESCRIPTOR_KEYS = new Set(['options', 'required', 'value', 'error', 'field', 'fieldKey', 'id']);

const isDescriptorEventKey = (key: string) => /^on[A-Z]/.test(key);

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> => (isPlainObject(value) ? value : {});

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const cloneValue = <T,>(value: T): T => {
    if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)])) as T;
    }

    return value;
};

const formatLabel = (value: string) =>
    value
        .split(/[-_:]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const createDefaultValue = (schema: DescriptorUiSchema): unknown => {
    switch (schema.type) {
        case 'string':
            return (schema as Extract<Ui, { type: 'string' }>).enum?.[0] ?? '';
        case 'number':
            return (schema as Extract<Ui, { type: 'number' }>).minimum ?? 0;
        case 'boolean':
            return false;
        case 'anyOf':
            return (schema as Extract<Ui, { type: 'anyOf' }>).multiple ? [] : (schema as Extract<Ui, { type: 'anyOf' }>).items[0]?.value;
        case 'array':
            return [];
        case 'object':
            return {};
        default:
            return undefined;
    }
};

const getAtPath = (value: unknown, path: Path): unknown => {
    let current = value;

    for (const segment of path) {
        if (typeof segment === 'number') {
            if (!Array.isArray(current)) return undefined;
            current = current[segment];
            continue;
        }

        if (!isPlainObject(current)) return undefined;
        current = current[segment];
    }

    return current;
};

const compactContainer = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.length ? value : undefined;
    if (isPlainObject(value)) return Object.keys(value).length ? value : undefined;
    return value;
};

const setAtPath = (source: unknown, path: Path, nextValue: unknown): unknown => {
    if (!path.length) return cloneValue(nextValue);

    const [head, ...rest] = path;
    const container = typeof head === 'number' ? asArray(source).slice() : { ...asRecord(source) };

    if (!rest.length) {
        if (typeof head === 'number') {
            container[head] = cloneValue(nextValue);
        } else {
            (container as Record<string, unknown>)[head] = cloneValue(nextValue);
        }

        return container;
    }

    const existingChild = typeof head === 'number' ? container[head] : (container as Record<string, unknown>)[head];
    const child = setAtPath(existingChild, rest, nextValue);

    if (typeof head === 'number') {
        container[head] = child;
    } else {
        (container as Record<string, unknown>)[head] = child;
    }

    return container;
};

const removeAtPath = (source: unknown, path: Path): unknown => {
    if (!path.length) return undefined;

    const [head, ...rest] = path;

    if (typeof head === 'number') {
        const container = asArray(source).slice();

        if (!rest.length) {
            if (head >= 0 && head < container.length) container.splice(head, 1);
            return compactContainer(container);
        }

        const nextChild = removeAtPath(container[head], rest);
        if (nextChild === undefined) container.splice(head, 1);
        else container[head] = nextChild;
        return compactContainer(container);
    }

    const container = { ...asRecord(source) };

    if (!rest.length) {
        delete container[head];
        return compactContainer(container);
    }

    const nextChild = removeAtPath(container[head], rest);
    if (nextChild === undefined) delete container[head];
    else container[head] = nextChild;
    return compactContainer(container);
};

const getVisibleObjectEntries = (schema: DescriptorUiSchemaMap) =>
    Object.entries(schema).filter(([key]) => !RESERVED_DESCRIPTOR_KEYS.has(key) && !isDescriptorEventKey(key));

const getOrderedObjectEntries = (schema: DescriptorUiObjectSchema) => {
    const visibleEntries = getVisibleObjectEntries(schema.fields);
    const byKey = new Map<string, DescriptorUiSchema>(visibleEntries);
    const ordered: Array<[string, DescriptorUiSchema]> = [];

    for (const key of schema.order ?? []) {
        const entry = byKey.get(key);
        if (!entry) continue;
        ordered.push([key, entry]);
        byKey.delete(key);
    }

    ordered.push(...Array.from(byKey.entries()).sort(([left], [right]) => left.localeCompare(right)));
    return ordered;
};

const inferShapeKey = (shape: DescriptorUiSchemaMap | undefined, value: unknown) => {
    if (!shape) return undefined;

    const entries = Object.entries(shape);
    if (!entries.length) return undefined;

    const match = entries.find(([, schema]) => {
        switch (schema.type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return isPlainObject(value);
            case 'anyOf':
                return Array.isArray(value) === Boolean((schema as Extract<Ui, { type: 'anyOf' }>).multiple);
            default:
                return false;
        }
    });

    return match?.[0] ?? entries[0]?.[0];
};

export const getDescriptorUiEntries = (schema?: DescriptorUiSchemaMap) => getVisibleObjectEntries(schema ?? {});

export const getDescriptorUiKeys = (schema?: DescriptorUiSchemaMap) => getDescriptorUiEntries(schema).map(([key]) => key);

export interface DescriptorSettingsProps {
    schema: DescriptorUiSchemaMap;
    defaults: Record<string, unknown>;
    onChange: (nextDefaults: Record<string, unknown> | undefined) => void;
}

type DescriptorNodeProps = {
    path: Path;
    schema: DescriptorUiSchema;
    value: unknown;
    hasOverride: boolean;
    onSet: (path: Path, value: unknown) => void;
    onClear: (path: Path) => void;
    allowClear?: boolean;
};

type DescriptorObjectFieldProps = Omit<DescriptorNodeProps, 'schema'> & {
    schema: DescriptorUiObjectSchema;
};

type DescriptorArrayFieldProps = Omit<DescriptorNodeProps, 'schema'> & {
    schema: DescriptorUiArraySchema;
};

const noop = () => {};

function UnknownDescriptorUiField({ schema }: { schema: DescriptorUiSchema }) {
    return (
        <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/20 dark:text-amber-200">
            No descriptor settings renderer is registered for "{schema.type}".
        </div>
    );
}

function DescriptorPrimitiveField({ schema, value, hasOverride, onSet, onClear, path }: DescriptorNodeProps) {
    const registry = useDescriptorUiRendererRegistry();
    const renderer = registry.resolve(schema.type);

    if (!renderer) {
        return <UnknownDescriptorUiField schema={schema} />;
    }

    return renderer({
        name: String(path.at(-1) ?? ''),
        path,
        schema,
        value,
        hasOverride,
        onChange: (nextValue) => onSet(path, nextValue),
        onClear: () => onClear(path),
        onBlur: noop,
        disabled: false,
    });
}

function DescriptorObjectField({ schema, value, hasOverride, onSet, onClear, path, allowClear = true }: DescriptorObjectFieldProps) {
    const objectValue = asRecord(value);
    const shapeEntries = useMemo(() => Object.entries(schema.shape ?? {}), [schema.shape]);
    const [draftKey, setDraftKey] = useState('');
    const [draftShape, setDraftShape] = useState(shapeEntries[0]?.[0] ?? '');
    const [activeShapes, setActiveShapes] = useState<Record<string, string>>({});
    const orderedEntries = useMemo(() => getOrderedObjectEntries(schema), [schema]);
    const dynamicKeys = Object.keys(objectValue).filter((key) => !hasOwn(schema.fields, key));

    const commitObject = (nextObject: Record<string, unknown> | undefined) => {
        if (!nextObject || !Object.keys(nextObject).length) {
            onClear(path);
            return;
        }

        onSet(path, nextObject);
    };

    const renameDynamicKey = (currentKey: string, rawNextKey: string) => {
        const nextKey = rawNextKey.trim();
        if (!nextKey || nextKey === currentKey || hasOwn(objectValue, nextKey)) return;

        const nextObject = { ...objectValue, [nextKey]: objectValue[currentKey] };
        delete nextObject[currentKey];
        commitObject(nextObject);

        setActiveShapes((current) => {
            const next = { ...current };
            if (next[currentKey]) {
                next[nextKey] = next[currentKey];
                delete next[currentKey];
            }
            return next;
        });
    };

    const addDynamicKey = () => {
        const nextKey = draftKey.trim();
        if (!nextKey || hasOwn(objectValue, nextKey)) return;

        const nextSchema = schema.shape?.[draftShape] ?? shapeEntries[0]?.[1];
        if (!nextSchema) return;

        commitObject({
            ...objectValue,
            [nextKey]: createDefaultValue(nextSchema),
        });
        setActiveShapes((current) => ({ ...current, [nextKey]: draftShape }));
        setDraftKey('');
    };

    return (
        <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
            <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{schema.label}</h4>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{schema.description}</p>
                    </div>
                    {allowClear && hasOverride ? (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onClear(path)}>
                            Reset
                        </Button>
                    ) : null}
                </div>

                <div className="space-y-4">
                    {orderedEntries.map(([key, childSchema]) => (
                        <DescriptorNodeField
                            key={key}
                            path={[...path, key]}
                            schema={childSchema}
                            value={objectValue[key]}
                            hasOverride={hasOwn(objectValue, key)}
                            onSet={onSet}
                            onClear={onClear}
                        />
                    ))}

                    {dynamicKeys.map((key) => {
                        const shapeKey = activeShapes[key] ?? inferShapeKey(schema.shape, objectValue[key]);
                        const shapeSchema = (shapeKey && schema.shape?.[shapeKey]) ?? shapeEntries[0]?.[1];

                        if (!shapeSchema) return null;

                        return (
                            <div key={key} className="space-y-3 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                                    <InputField
                                        variant="text"
                                        label="Key"
                                        value={key}
                                        onChange={(event) => {
                                            const nextValue = String(event.value ?? '');
                                            if (!nextValue.trim()) return;
                                            renameDynamicKey(key, nextValue);
                                        }}
                                    />
                                    {shapeEntries.length > 1 ? (
                                        <InputField
                                            variant="select"
                                            label="Shape"
                                            value={shapeKey}
                                            options={shapeEntries.map(([label]) => ({ label, value: label })) as any}
                                            onChange={(event) => {
                                                const nextShape = String(event.value ?? '');
                                                const nextSchema = schema.shape?.[nextShape];
                                                if (!nextSchema) return;

                                                setActiveShapes((current) => ({ ...current, [key]: nextShape }));
                                                commitObject({
                                                    ...objectValue,
                                                    [key]: createDefaultValue(nextSchema),
                                                });
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">
                                            Shape: {shapeKey ?? shapeEntries[0]?.[0] ?? 'Custom'}
                                        </div>
                                    )}
                                    <div className="flex items-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => {
                                                const nextObject = { ...objectValue };
                                                delete nextObject[key];
                                                commitObject(nextObject);
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>

                                <DescriptorNodeField
                                    path={[...path, key]}
                                    schema={shapeSchema}
                                    value={objectValue[key]}
                                    hasOverride
                                    onSet={onSet}
                                    onClear={onClear}
                                    allowClear={false}
                                />
                            </div>
                        );
                    })}

                    {schema.editable && shapeEntries.length ? (
                        <div className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_180px_auto] dark:border-slate-700">
                            <InputField
                                variant="text"
                                label="New key"
                                value={draftKey}
                                placeholder="Add a property key"
                                onChange={(event) => setDraftKey(String(event.value ?? ''))}
                            />
                            <InputField
                                variant="select"
                                label="Shape"
                                value={draftShape}
                                options={shapeEntries.map(([label]) => ({ label, value: label })) as any}
                                onChange={(event) => setDraftShape(String(event.value ?? shapeEntries[0]?.[0] ?? ''))}
                            />
                            <div className="flex items-end">
                                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addDynamicKey}>
                                    Add entry
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function DescriptorArrayField({ schema, value, hasOverride, onSet, onClear, path, allowClear = true }: DescriptorArrayFieldProps) {
    const arrayValue = asArray(value);
    const shapeEntries = useMemo(() => Object.entries(schema.shape ?? {}), [schema.shape]);
    const [draftShape, setDraftShape] = useState(shapeEntries[0]?.[0] ?? '');
    const [activeShapes, setActiveShapes] = useState<Record<number, string>>({});

    const commitArray = (nextArray: unknown[]) => {
        if (!nextArray.length) {
            onClear(path);
            return;
        }

        onSet(path, nextArray);
    };

    const appendItem = () => {
        if (schema.maxItems !== undefined && arrayValue.length >= schema.maxItems) return;

        const nextSchema = schema.item ?? (draftShape ? schema.shape?.[draftShape] : undefined) ?? shapeEntries[0]?.[1];
        if (!nextSchema) return;

        const nextIndex = arrayValue.length;
        commitArray([...arrayValue, createDefaultValue(nextSchema)]);

        if (!schema.item && draftShape) {
            setActiveShapes((current) => ({ ...current, [nextIndex]: draftShape }));
        }
    };

    return (
        <div className="rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
            <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{schema.label}</h4>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{schema.description}</p>
                    </div>
                    {allowClear && hasOverride ? (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onClear(path)}>
                            Reset
                        </Button>
                    ) : null}
                </div>

                <div className="space-y-4">
                    {schema.items
                        ? schema.items.map((childSchema, index) => (
                              <DescriptorNodeField
                                  key={`${path.join('.')}:${index}`}
                                  path={[...path, index]}
                                  schema={childSchema}
                                  value={arrayValue[index]}
                                  hasOverride={index < arrayValue.length}
                                  onSet={onSet}
                                  onClear={onClear}
                                  allowClear={false}
                              />
                          ))
                        : arrayValue.map((item, index) => {
                              const shapeKey = activeShapes[index] ?? inferShapeKey(schema.shape, item);
                              const itemSchema = schema.item ?? (shapeKey ? schema.shape?.[shapeKey] : undefined) ?? shapeEntries[0]?.[1];

                              if (!itemSchema) return null;

                              return (
                                  <div
                                      key={`${path.join('.')}:${index}`}
                                      className="space-y-3 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700"
                                  >
                                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                                          <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">
                                              {formatLabel(schema.label)} item {index + 1}
                                          </div>
                                          {!schema.item && shapeEntries.length > 1 ? (
                                              <InputField
                                                  variant="select"
                                                  label="Shape"
                                                  value={shapeKey}
                                                  options={shapeEntries.map(([label]) => ({ label, value: label })) as any}
                                                  onChange={(event) => {
                                                      const nextShape = String(event.value ?? '');
                                                      const nextSchema = schema.shape?.[nextShape];
                                                      if (!nextSchema) return;

                                                      setActiveShapes((current) => ({ ...current, [index]: nextShape }));
                                                      const nextArray = arrayValue.slice();
                                                      nextArray[index] = createDefaultValue(nextSchema);
                                                      commitArray(nextArray);
                                                  }}
                                              />
                                          ) : (
                                              <div />
                                          )}
                                          <div className="flex items-end">
                                              <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="w-full"
                                                  disabled={schema.minItems !== undefined && arrayValue.length <= schema.minItems}
                                                  onClick={() => {
                                                      const nextArray = arrayValue.slice();
                                                      nextArray.splice(index, 1);
                                                      commitArray(nextArray);
                                                  }}
                                              >
                                                  Remove
                                              </Button>
                                          </div>
                                      </div>

                                      <DescriptorNodeField
                                          path={[...path, index]}
                                          schema={itemSchema}
                                          value={item}
                                          hasOverride
                                          onSet={onSet}
                                          onClear={onClear}
                                          allowClear={false}
                                      />
                                  </div>
                              );
                          })}

                    {!schema.items && (schema.editable ?? true) ? (
                        <div className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_180px_auto] dark:border-slate-700">
                            <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">Add another {schema.label.toLowerCase()}</div>
                            {!schema.item && shapeEntries.length > 1 ? (
                                <InputField
                                    variant="select"
                                    label="Shape"
                                    value={draftShape}
                                    options={shapeEntries.map(([label]) => ({ label, value: label })) as any}
                                    onChange={(event) => setDraftShape(String(event.value ?? shapeEntries[0]?.[0] ?? ''))}
                                />
                            ) : (
                                <div />
                            )}
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    disabled={schema.maxItems !== undefined && arrayValue.length >= schema.maxItems}
                                    onClick={appendItem}
                                >
                                    Add item
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function DescriptorNodeField(props: DescriptorNodeProps) {
    if (props.schema.type === 'object') {
        return <DescriptorObjectField {...props} schema={props.schema as DescriptorUiObjectSchema} />;
    }

    if (props.schema.type === 'array') {
        return <DescriptorArrayField {...props} schema={props.schema as DescriptorUiArraySchema} />;
    }

    return <DescriptorPrimitiveField {...props} />;
}

export function DescriptorSettings({ schema, defaults, onChange }: DescriptorSettingsProps) {
    const entries = useMemo(() => getDescriptorUiEntries(schema), [schema]);

    const handleSet = (path: Path, value: unknown) => {
        const nextDefaults = setAtPath(defaults, path, value);
        onChange(isPlainObject(nextDefaults) ? nextDefaults : undefined);
    };

    const handleClear = (path: Path) => {
        const nextDefaults = removeAtPath(defaults, path);
        onChange(isPlainObject(nextDefaults) ? nextDefaults : undefined);
    };

    if (!entries.length) {
        return <p className="text-xs text-slate-500 dark:text-slate-400">This input descriptor does not expose editable runtime settings.</p>;
    }

    return (
        <div className="space-y-4">
            {entries.map(([key, fieldSchema]) => {
                const path = [key];
                return (
                    <DescriptorNodeField
                        key={key}
                        path={path}
                        schema={fieldSchema}
                        value={getAtPath(defaults, path)}
                        hasOverride={hasOwn(defaults, key)}
                        onSet={handleSet}
                        onClear={handleClear}
                    />
                );
            })}
        </div>
    );
}
