// SPDX-License-Identifier: GPL-3.0-only
export const isoNow = () => new Date().toISOString();

export const isoDaysAgo = (days: number) => {
    const ms = Math.max(0, days) * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms).toISOString();
};
