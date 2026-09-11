import { describe, expect, it, vi } from 'vitest';
import {
    createDefaultDescriptorUiRendererRegistry,
    createDescriptorUiRendererRegistry,
    type DescriptorUiRenderer,
} from './descriptor-ui-renderers.tsx';

vi.mock('@timeax/form-palette', () => ({
    InputField: () => null,
}));

describe('descriptor UI renderer registry', () => {
    it('registers the built-in descriptor renderers by default', () => {
        const registry = createDefaultDescriptorUiRendererRegistry();

        expect(registry.has('string')).toBe(true);
        expect(registry.has('number')).toBe(true);
        expect(registry.has('boolean')).toBe(true);
        expect(registry.has('anyOf')).toBe(true);
    });

    it('registers, replaces, resolves, and unregisters custom renderers', () => {
        const registry = createDescriptorUiRendererRegistry();
        const first: DescriptorUiRenderer = () => null;
        const second: DescriptorUiRenderer = () => null;

        registry.register('host:test', first);
        expect(registry.resolve('host:test')).toBe(first);

        registry.register('host:test', second);
        expect(registry.resolve('host:test')).toBe(second);

        registry.unregister('host:test');
        expect(registry.resolve('host:test')).toBeUndefined();
        expect(registry.has('host:test')).toBe(false);
    });

    it('returns undefined for unknown renderer types', () => {
        const registry = createDescriptorUiRendererRegistry();

        expect(registry.resolve('host:missing')).toBeUndefined();
    });

    it('rejects invalid registration inputs', () => {
        const registry = createDescriptorUiRendererRegistry();

        expect(() => registry.register('', () => null)).toThrow(/non-empty/);
        expect(() => registry.register('   ', () => null)).toThrow(/non-empty/);
        expect(() => registry.register('host:bad', undefined as any)).toThrow(/function/);
    });
});
