import { InputField } from '@timeax/form-palette';

type RenameNodeFieldProps = {
    value: string;
    onChange: (next: string) => void;
    onEscape: () => void;
};

export function RenameNodeField({ value, onChange, onEscape }: RenameNodeFieldProps) {
    return (
        <InputField
            variant="text"
            label="Node label"
            value={value}
            placeholder="Enter node label"
            onChange={(event) => onChange(String(event.value ?? ''))}
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                onEscape();
            }}
        />
    );
}
