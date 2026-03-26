import type { BuilderServiceSummary } from '@/builder/bottom-panel.ts';
import { type ServiceContextSnapshot, type ServiceListRowVM } from '@/builder/service-context.ts';
import { StatusDot } from '@/components/builder/index.tsx';
import { ServiceMetaPopover } from '@/components/service-meta-popover.tsx';
import { statusBadgeClassName, filterChipClassName } from './utils.tsx';
import { cn } from '@/lib/utils.ts';

type ServiceDetailCardProps = {
    mode: 'active' | 'all' | 'catalog';
    row: ServiceListRowVM;
    snapshot: ServiceContextSnapshot | null;
    onNodeClick: (nodeId: string) => void;
    onOpenFallbackQuickAdd?: (service: BuilderServiceSummary) => void;
    onOpenFallbackEditor?: (service: BuilderServiceSummary) => void;
};

export function ServiceDetailCard({
    mode,
    row,
    snapshot,
    onNodeClick,
    onOpenFallbackQuickAdd,
    onOpenFallbackEditor,
}: ServiceDetailCardProps) {
    const summary = row.summary;
    const service = row.service;

    return (
        <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <StatusDot tone={row.statusTone} className="mt-0.5" />
                            <h5 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{summary.name}</h5>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>#{summary.id}</span>
                            {summary.category ? <span>{summary.category}</span> : null}
                            {summary.platformId ? <span>{summary.platformId}</span> : null}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ServiceMetaPopover meta={service?.meta} />
                        {mode === 'active' && onOpenFallbackQuickAdd ? (
                            <button
                                type="button"
                                onClick={() => onOpenFallbackQuickAdd(summary)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                                Add fallbacks
                            </button>
                        ) : null}
                        {mode === 'active' && onOpenFallbackEditor ? (
                            <button
                                type="button"
                                onClick={() => onOpenFallbackEditor(summary)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                                Open fallback editor
                            </button>
                        ) : null}
                        <span className={statusBadgeClassName(row.statusTone)}>{row.statusLabel}</span>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DetailMetric label="Rate" value={summary.rate != null ? String(summary.rate) : 'Not set'} />
                    <DetailMetric label="Estimate" value={summary.estimate ?? 'No estimate'} />
                    <DetailMetric label="Min" value={summary.min != null ? String(summary.min) : '0'} />
                    <DetailMetric label="Max" value={summary.max != null ? String(summary.max) : 'Unlimited'} />
                </div>
            </div>

            {mode !== 'active' ? (
                <section className="space-y-3">
                    <SectionTitle
                        title="Context fit"
                        description={
                            mode === 'catalog'
                                ? 'This summary shows how the service fits the current visible-group context while browsing catalog groups.'
                                : 'This summary shows how the service fits the current visible-group context.'
                        }
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                        <div className="flex flex-wrap gap-2">
                            <FilterChip label={row.check?.fitsConstraints ? 'Constraints fit' : 'Constraint mismatch'} tone={row.check?.fitsConstraints ? 'success' : 'danger'} />
                            <FilterChip label={row.check?.passesRate ? 'Rate ok' : 'Rate blocked'} tone={row.check?.passesRate ? 'success' : 'warning'} />
                            <FilterChip
                                label={snapshot?.state.enforcePolicies === false ? 'Policies relaxed' : row.check?.passesPolicies ? 'Policies pass' : 'Policy blocked'}
                                tone={snapshot?.state.enforcePolicies === false ? 'default' : row.check?.passesPolicies ? 'success' : 'danger'}
                            />
                        </div>
                        {row.reasonLabels.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {row.reasonLabels.map((reason) => (
                                    <span key={`${row.id}:${reason}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                                        {reason}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                This service is a clean fit for the current visible-group and selected-trigger context.
                            </p>
                        )}
                    </div>
                </section>
            ) : null}

            <section className="space-y-3">
                <SectionTitle title="Capabilities" description="Flags and pricing hints attached to this service." />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                    {summary.flags.length || service?.meta ? (
                        <div className="flex flex-wrap gap-2">
                            {summary.flags.map((flag) => (
                                <span key={flag} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                                    {flag}
                                </span>
                            ))}
                            {Object.keys(service?.meta ?? {})
                                .slice(0, 3)
                                .map((key) => (
                                    <span key={key} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        {key}
                                    </span>
                                ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No capability flags were published for this service.</p>
                    )}
                </div>
            </section>

            <section className="space-y-3">
                <SectionTitle title="Bindings" description="Nodes currently connected to this service. Click any node to jump back into the canvas." />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
                    {summary.attachedNodeIds.length ? (
                        <div className="flex flex-wrap gap-2">
                            {summary.attachedNodeIds.map((nodeId, index) => (
                                <button
                                    key={`${row.id}:${nodeId}`}
                                    type="button"
                                    onClick={() => onNodeClick(nodeId)}
                                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {summary.attachedNodeLabels[index] ?? nodeId}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">This service is not attached to any node yet. Drag it from the catalog onto a node to assign it.</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
    );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-950">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
    );
}

function FilterChip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
    return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', filterChipClassName(tone))}>{label}</span>;
}
