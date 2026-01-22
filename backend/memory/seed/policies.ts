import type { DynamicRule } from '@timeax/digital-service-engine/schema';

export const policies: readonly DynamicRule[] = [
    {
        id: 'rule:no-mix-instagram-youtube',
        label: 'Do not mix Instagram + YouTube services',
        scope: 'global',
        subject: 'services',
        filter: {
            role: 'both',
            where: [
                { path: 'service.category', op: 'sw', value: 'instagram/' },
                { path: 'service.category', op: 'sw', value: 'youtube/' },
            ],
        },
        op: 'no_mix',
        severity: 'warning',
        message: 'Avoid mixing Instagram and YouTube in the same configuration.',
    },
];

export const policiesByBranch: Readonly<Record<string, readonly DynamicRule[]>> = {
    'branch:experiment': [
        ...policies,
        {
            id: 'rule:exp:unique-service',
            label: 'Experiment: enforce unique services',
            scope: 'global',
            subject: 'services',
            op: 'unique',
            severity: 'warning',
            message: 'Experiment branch prefers unique service selections.',
        },
    ],
};
