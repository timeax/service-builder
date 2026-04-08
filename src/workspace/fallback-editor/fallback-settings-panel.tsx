import { Alert, AlertDescription } from '@/components/ui/alert.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useFallbackEditor } from '@timeax/digital-service-engine/react';
import type { FallbackSettings, RatePolicy } from '@timeax/digital-service-engine/schema';
import { InputField } from '@timeax/form-palette';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { SectionCard, SectionHeader } from './shared.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';

export function FallbackSettingsPanel() {
    const { settings, saveSettings, settingsSaving } = useFallbackEditor();

    const [draft, setDraft] = useState<FallbackSettings>(settings);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setDraft(settings);
        setSaved(false);
        setError(null);
    }, [settings]);

    const changed = JSON.stringify(draft ?? {}) !== JSON.stringify(settings ?? {});
    const ratePolicy: RatePolicy = draft.ratePolicy ?? { kind: 'lte_primary', pct: 5 };

    async function handleSave() {
        setError(null);
        setSaved(false);

        try {
            await saveSettings(draft);
            setSaved(true);
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Failed to save fallback settings.');
        }
    }

    function setRatePolicy(next: RatePolicy) {
        setDraft((previous) => ({
            ...previous,
            ratePolicy: next,
        }));
    }

    return (
        <SectionCard className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <SectionHeader
                    title="Fallback settings"
                    description="Persist policy changes through the host editor without changing the fallback payload shape."
                    action={
                        <Button type="button" onClick={() => void handleSave()} disabled={!changed || settingsSaving} className="rounded-md">
                            {settingsSaving ? 'Saving...' : 'Save settings'}
                        </Button>
                    }
                />
            </div>

            <ScrollArea className="min-h-0 flex-1 p-5" data-testid="fallback-editor-settings-scroll">
                <div className="space-y-5">
                    <SettingRow title="Require constraint fit" hint="Reject or warn when a candidate does not match effective tag constraints.">
                        <InputField
                            variant="toggle"
                            value={Boolean(draft.requireConstraintFit)}
                            onChange={({ value }) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    requireConstraintFit: Boolean(value),
                                }))
                            }
                            onText="Enabled"
                            offText="Disabled"
                        />
                    </SettingRow>

                    <SettingRow title="Rate policy" hint="Controls how fallback service rates are compared against the primary service.">
                        <div className="flex flex-col gap-2 md:items-end">
                            <InputField
                                variant="select"
                                value={ratePolicy.kind}
                                onChange={({ value }) => {
                                    const kind = value as RatePolicy['kind'];
                                    const pct = ratePolicy.kind === 'eq_primary' ? 5 : ratePolicy.pct;

                                    if (kind === 'eq_primary') {
                                        setRatePolicy({ kind: 'eq_primary' });
                                        return;
                                    }

                                    if (kind === 'lte_primary') {
                                        setRatePolicy({ kind: 'lte_primary', pct });
                                        return;
                                    }

                                    if (kind === 'within_pct') {
                                        setRatePolicy({ kind: 'within_pct', pct });
                                        return;
                                    }

                                    setRatePolicy({ kind: 'at_least_pct_lower', pct });
                                }}
                                options={[
                                    { value: 'eq_primary', label: 'Equals Primary' },
                                    { value: 'lte_primary', label: 'Less than or Equals' },
                                    { value: 'within_pct', label: 'Within Range' },
                                    { value: 'at_least_pct_lower', label: 'Lower by' },
                                ]}
                                clearable={false}
                            />
                        </div>
                    </SettingRow>
                    {ratePolicy.kind !== 'eq_primary' ? (
                        <SettingRow title={'Rate Percentage'} hint={'Rate percentage the policy is guarded by'}>
                            <div className="flex items-center gap-2">
                                <div className="w-32">
                                    <InputField
                                        variant="number"
                                        value={ratePolicy.pct}
                                        onChange={({ value }) => {
                                            const pct = typeof value === 'number' ? value : Number(value ?? 0);
                                            setRatePolicy({
                                                ...ratePolicy,
                                                pct,
                                            });
                                        }}
                                        min={0}
                                        step={0.01}
                                        fullWidth
                                        showButtons
                                        trailingIcons={[<span className={'pr-2'}>%</span>]}
                                    />
                                </div>
                            </div>
                        </SettingRow>
                    ) : null}

                    <SettingRow title="Selection strategy" hint="How valid fallback candidates are ordered in previews.">
                        <InputField
                            variant="select"
                            label="Selection strategy"
                            value={draft.selectionStrategy ?? 'priority'}
                            onChange={({ value }) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    selectionStrategy: value as 'priority' | 'cheapest',
                                }))
                            }
                            options={[
                                { value: 'priority', label: 'priority' },
                                { value: 'cheapest', label: 'cheapest' },
                            ]}
                            clearable={false}
                        />
                    </SettingRow>

                    <SettingRow title="Mode" hint="Use strict for enforced filtering, dev for advisory feedback.">
                        <InputField
                            variant="select"
                            label="Mode"
                            value={draft.mode ?? 'strict'}
                            onChange={({ value }) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    mode: value as 'strict' | 'dev',
                                }))
                            }
                            options={[
                                { value: 'strict', label: 'strict' },
                                { value: 'dev', label: 'dev' },
                            ]}
                            clearable={false}
                        />
                    </SettingRow>

                    {saved && !error ? (
                        <Alert className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                            <AlertDescription>Settings saved.</AlertDescription>
                        </Alert>
                    ) : null}

                    {error ? (
                        <Alert variant="destructive" className="border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                </div>
            </ScrollArea>
        </SectionCard>
    );
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-dashed border-slate-200 pb-5 last:border-b-0 last:pb-0 md:flex-row md:items-center md:justify-between dark:border-slate-800">
            <div className="max-w-xl">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
            </div>
            <div>{children}</div>
        </div>
    );
}
