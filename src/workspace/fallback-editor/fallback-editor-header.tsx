import { Button } from '@/components/ui/button.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { SectionCard, SectionHeader, ToneBadge } from './shared.tsx';

type Props = {
    activeServiceLabel?: string;
    registrationCount: number;
    changed: boolean;
    onReset?: () => void | Promise<void>;
    onValidate?: () => void | Promise<void>;
    onSave?: () => void | Promise<void>;
    resetting?: boolean;
    validating?: boolean;
    saving?: boolean;
};

export function FallbackEditorHeader({
    activeServiceLabel,
    registrationCount,
    changed,
    onReset,
    onValidate,
    onSave,
    resetting = false,
    validating = false,
    saving = false,
}: Props) {
    return (
        <SectionCard className="px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-3">
                    <SectionHeader
                        title="Fallback editor"
                        description="Manage global and node-scoped fallback registrations with the workspace design system."
                    />

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <ToneBadge label={activeServiceLabel ?? 'No service selected'} tone="info" />
                        <ToneBadge label={`${registrationCount} registration${registrationCount === 1 ? '' : 's'}`} />
                        <ToneBadge label={changed ? 'Unsaved changes' : 'Synced'} tone={changed ? 'warning' : 'success'} />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={onReset} disabled={resetting}>
                        <RotateCcw className="size-4" />
                        {resetting ? 'Resetting...' : 'Reset'}
                    </Button>
                    <Button type="button" variant="outline" onClick={onValidate} disabled={validating}>
                        <ShieldCheck className="size-4" />
                        {validating ? 'Validating...' : 'Validate'}
                    </Button>
                    <Separator orientation="vertical" className="hidden h-8 xl:block" />
                    <Button type="button" onClick={onSave} disabled={saving}>
                        <Save className="size-4" />
                        {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
}
