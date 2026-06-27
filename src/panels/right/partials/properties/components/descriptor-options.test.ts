import { describe, expect, it, vi } from 'vitest';
import { resolveFieldOptionCapability } from './descriptor-options.ts';

const resolveInputDescriptorMock = vi.hoisted(() => vi.fn());

vi.mock('@timeax/digital-service-engine/react', () => ({
    resolveInputDescriptor: (...args: any[]) => resolveInputDescriptorMock(...args),
}));

describe('resolveFieldOptionCapability', () => {
    it('detects child option capability from descriptor options', () => {
        resolveInputDescriptorMock.mockReturnValueOnce({
            options: {
                supported: true,
                autoCreate: true,
                defaultLabel: 'Parent',
                defaultValue: 'parent',
                children: {
                    supported: true,
                    defaultLabel: 'Child',
                    defaultValue: 'child',
                },
            },
        });

        expect(resolveFieldOptionCapability({} as any, { type: 'select', meta: { variant: 'treeselect' } })).toEqual({
            descriptorResolved: true,
            supportsOptions: true,
            supportsChildOptions: true,
            shouldAutoCreate: true,
            defaultLabel: 'Parent',
            defaultValue: 'parent',
            childDefaultLabel: 'Child',
            childDefaultValue: 'child',
        });
    });

    it('keeps flat descriptors flat', () => {
        resolveInputDescriptorMock.mockReturnValueOnce({
            options: {
                supported: true,
                defaultLabel: 'Option',
                defaultValue: 'option',
            },
        });

        const capability = resolveFieldOptionCapability({} as any, { type: 'select' });

        expect(capability.supportsOptions).toBe(true);
        expect(capability.supportsChildOptions).toBe(false);
        expect(capability.childDefaultLabel).toBe('Option');
        expect(capability.childDefaultValue).toBe('option');
    });
});
