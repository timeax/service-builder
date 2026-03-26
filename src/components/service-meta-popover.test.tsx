import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceMetaPopover } from './service-meta-popover.tsx';

describe('ServiceMetaPopover', () => {
    it('opens on click and shows invoice rows', async () => {
        render(<ServiceMetaPopover meta={{ raw: { key: 'value' }, tier: 'gold' }} />);

        fireEvent.click(screen.getByRole('button', { name: 'More service info' }));

        expect(await screen.findByText('More info')).toBeInTheDocument();
        expect(screen.getByText('raw.key')).toBeInTheDocument();
        expect(screen.getByText('value')).toBeInTheDocument();
        expect(screen.getByText('tier')).toBeInTheDocument();
        expect(screen.getByText('gold')).toBeInTheDocument();
    });

    it('opens on delayed hover', async () => {
        render(<ServiceMetaPopover meta={{ raw: { key: 'value' } }} />);
        const trigger = screen.getByRole('button', { name: 'More service info' });

        fireEvent.pointerEnter(trigger);
        expect(await screen.findByText('raw.key')).toBeInTheDocument();
    });

    it('shows empty state when no primitive meta exists', async () => {
        render(<ServiceMetaPopover meta={{ nested: { more: {} }, arr: ['x'] }} />);

        fireEvent.click(screen.getByRole('button', { name: 'More service info' }));
        expect(await screen.findByText('No primitive meta properties available.')).toBeInTheDocument();
    });
});
