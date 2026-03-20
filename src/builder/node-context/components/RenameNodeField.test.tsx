import { fireEvent, render, screen } from '@testing-library/react';
import { RenameNodeField } from './RenameNodeField.tsx';

vi.mock('@timeax/form-palette', () => ({
    InputField: ({ label, value, onChange, onKeyDown, placeholder }: any) => (
        <label>
            {label}
            <input
                aria-label={label}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange?.({ value: event.target.value })}
                onKeyDown={onKeyDown}
            />
        </label>
    ),
}));

describe('RenameNodeField', () => {
    it('updates value through InputField payload', () => {
        const onChange = vi.fn();
        const onEscape = vi.fn();

        render(<RenameNodeField value="" onChange={onChange} onEscape={onEscape} />);
        fireEvent.change(screen.getByLabelText('Node label'), { target: { value: 'Renamed Node' } });

        expect(onChange).toHaveBeenCalledWith('Renamed Node');
    });

    it('triggers escape handler on Escape key', () => {
        const onChange = vi.fn();
        const onEscape = vi.fn();

        render(<RenameNodeField value="Node" onChange={onChange} onEscape={onEscape} />);
        fireEvent.keyDown(screen.getByLabelText('Node label'), { key: 'Escape' });

        expect(onEscape).toHaveBeenCalledTimes(1);
    });
});
