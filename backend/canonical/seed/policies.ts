// SPDX-License-Identifier: GPL-3.0-only
import type { ServicePublicationPolicyRule } from "@elqora/dgp-validation";

export const policies: ServicePublicationPolicyRule[] = [
  {
    id: "rule:no-mix-platforms",
    label: "Do not mix service platforms",
    scope: "global",
    subject: "services",
    filter: { role: "both" },
    projection: "category",
    op: "all_equal",
    severity: "warning",
    message: "A product should normally use services from one platform.",
  },
];
