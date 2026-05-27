import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Dropdown from './index.tsx';

describe('Dropdown checkbox/radio layout', () => {
    it('preserves indicator gutter class for checkbox rows and avoids generic x-padding override', async () => {
        render(
            <Dropdown
                open
                onOpenChange={() => {}}
                trigger={<button type="button">Open menu</button>}
                menu={[
                    {
                        type: 'checkbox',
                        id: 'main-owner',
                        label: 'Main owner',
                        checked: true,
                        onCheckedChange: vi.fn(),
                    },
                ]}
            />,
        );

        const item = await screen.findByRole('menuitemcheckbox', { name: 'Main owner' });

        expect(item.className).toContain('pl-8');
        expect(item.className).not.toContain('px-2');
        expect(item.className).not.toContain('px-3');
    });

    it('preserves indicator gutter class for radio rows and avoids generic x-padding override', async () => {
        render(
            <Dropdown
                open
                onOpenChange={() => {}}
                trigger={<button type="button">Open menu</button>}
                menu={[
                    {
                        type: 'radio-group',
                        id: 'roles',
                        label: 'Roles',
                        value: 'admin',
                        onValueChange: vi.fn(),
                        items: [
                            { value: 'admin', label: 'Administrator' },
                            { value: 'owner', label: 'Main owner' },
                        ],
                    },
                ]}
            />,
        );

        const item = await screen.findByRole('menuitemradio', { name: 'Administrator' });

        expect(item.className).toContain('pl-8');
        expect(item.className).not.toContain('px-2');
        expect(item.className).not.toContain('px-3');
    });

    it('renders clean checkbox labels without prefixed symbol artifacts', async () => {
        render(
            <Dropdown
                open
                onOpenChange={() => {}}
                trigger={<button type="button">Open menu</button>}
                menu={[
                    { type: 'checkbox', id: 'main-owner', label: 'Main owner', checked: true, onCheckedChange: vi.fn() },
                    { type: 'checkbox', id: 'admin', label: 'Administrator', checked: false, onCheckedChange: vi.fn() },
                ]}
            />,
        );

        expect(await screen.findByText('Main owner')).toBeInTheDocument();
        expect(screen.getByText('Administrator')).toBeInTheDocument();
        expect(screen.queryByText('¥Main owner')).not.toBeInTheDocument();
    });
});
