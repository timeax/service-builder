import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import { useFallbackEditor, usePrimaryServiceList } from '@timeax/digital-service-engine/react';
import { InputField } from '@timeax/form-palette';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SectionCard, SectionHeader, ToneBadge } from './shared.tsx';

export function FallbackServiceSidebar() {
    const { activeServiceId, setActiveServiceId, get } = useFallbackEditor();
    const services = usePrimaryServiceList();
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return services;

        return services.filter((service) => {
            return (
                String(service.id).includes(normalizedQuery) ||
                String(service.name ?? '')
                    .toLowerCase()
                    .includes(normalizedQuery) ||
                String(service.platform ?? '')
                    .toLowerCase()
                    .includes(normalizedQuery)
            );
        });
    }, [query, services]);

    return (
        <SectionCard className="flex h-full min-h-0 min-w-70 flex-col overflow-hidden border-r-0">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 space-y-2">
                <SectionHeader title="Primary services" description="Choose the primary service whose fallback registrations you want to edit." />
                <InputField
                    variant="text"
                    value={query}
                    onChange={({ value }) => setQuery(String(value ?? ''))}
                    placeholder="Search primary service"
                    icon={<Search className="size-4 text-slate-400" />}
                />
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-3">
                    {filtered.map((service) => {
                        const selected = String(service.id) === String(activeServiceId);
                        const count = get(service.id).length;

                        return (
                            <button
                                key={String(service.id)}
                                type="button"
                                onClick={() => setActiveServiceId(service.id)}
                                className={cn(
                                    'w-full rounded-md border px-4 py-3 text-left transition',
                                    'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700',
                                    selected
                                        ? 'border-sky-300 bg-sky-50 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/10'
                                        : 'border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/70',
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p title={service.name} className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            Service #{String(service.id)} - {service.name ?? 'Unnamed'}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {service.platform ?? 'Unknown platform'}
                                            {typeof service.rate === 'number' ? ` | Rate ${service.rate}` : ''}
                                        </p>
                                    </div>

                                    <ToneBadge label={`${count} reg`} tone={selected ? 'info' : 'neutral'} className="shrink-0" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </SectionCard>
    );
}
