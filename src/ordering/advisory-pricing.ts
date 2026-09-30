// SPDX-License-Identifier: GPL-3.0-only
import type { AdvisoryServiceAmountContext } from '@elqora/dgp-ordering';

/** Host preview policy: only the primary selected service contributes a charge. */
export function primaryServiceAdvisoryAmounts({ quantity, service_ids, services }: AdvisoryServiceAmountContext): Record<string, number> {
    const catalog = new Map(services.map((service) => [String(service.id), service]));
    return Object.fromEntries(service_ids.map((id, index) => [String(id), index === 0 ? (catalog.get(String(id))?.rate ?? 0) * quantity : 0]));
}
