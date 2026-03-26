import type { DgpServiceMap } from '@timeax/digital-service-engine/schema';

export const services: DgpServiceMap = {
    1001: {
        id: 1001,
        name: 'Instagram Followers this shidshjs dcsh sojf dso sodhs jhdv sdh vshfdv sohfdv sohfs fhso fhsof sihfi • Fast',
        rate: 1.25,
        min: 50,
        max: 50000,
        category: 'instagram/followers',
        flags: {
            refill: { enabled: true, description: 'Refill available (30 days)' },
            dripfeed: { enabled: true, description: 'Drip-feed supported' },
        },
        estimates: {
            start: { min_seconds: 60, max_seconds: 600, label: '1–10 mins' },
            speed: { amount: 2000, per: 'day', unit: 'followers', label: '2k/day' },
            average: { min_seconds: 86400, max_seconds: 259200, label: '1–3 days' },
        },
        meta: { provider: 'demo', key: 'ig_follow_fast' },
    },
    1002: {
        id: 1002,
        name: 'TikTok Likes • Instant',
        rate: 0.75,
        min: 10,
        max: 100000,
        category: 'tiktok/likes',
        flags: {
            refill: { enabled: false, description: 'No refill for likes' },
            guaranteed: { enabled: true, description: 'Guaranteed delivery' },
        },
        estimates: {
            start: { min_seconds: 5, max_seconds: 45, label: 'instant' },
            speed: { amount: 10000, per: 'hour', unit: 'likes', label: '10k/hr' },
            average: { min_seconds: 3600, max_seconds: 21600, label: '1–6 hours' },
        },
        meta: { provider: 'demo', key: 'tt_likes_instant' },
    },
    1003: {
        id: 1003,
        name: 'YouTube Views • Steady',
        rate: 2.5,
        min: 100,
        max: 2000000,
        category: 'youtube/views',
        flags: {
            refill: { enabled: true, description: 'Refill up to 14 days' },
            geo: { enabled: true, description: 'Geo targeting supported' },
        },
        estimates: {
            start: { min_seconds: 600, max_seconds: 3600, label: '10–60 mins' },
            speed: { amount: 50000, per: 'day', unit: 'views', label: '50k/day' },
            average: { min_seconds: 86400, max_seconds: 604800, label: '1–7 days' },
        },
        meta: { provider: 'demo', key: 'yt_views_steady' },
    },
};
