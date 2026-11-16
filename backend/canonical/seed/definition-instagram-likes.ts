// SPDX-License-Identifier: GPL-3.0-only
import type { ProductDefinition } from "@elqora/dgp-spec";

// Canonical definition mirrored from the approved service-products ProductDefinition.
export const instagramLikesDefinition = {
  "id": "instagram-likes-likes",
  "name": "Instagram Likes",
  "filters": [
    {
      "id": "t:root",
      "label": "Instagram Likes",
      "service_id": 128
    },
    {
      "id": "t:standard",
      "label": "Standard Likes",
      "bind_id": "t:root",
      "service_id": 212
    },
    {
      "id": "t:quality",
      "label": "Quality",
      "bind_id": "t:root",
      "service_id": 136
    },
    {
      "id": "t:bot",
      "label": "Bot Likes",
      "bind_id": "t:root",
      "service_id": 224
    },
    {
      "id": "t:target",
      "label": "Targeted Likes",
      "bind_id": "t:root",
      "service_id": 275
    },
    {
      "id": "t:gender",
      "label": "Gender-Targeted Likes",
      "bind_id": "t:root",
      "service_id": 292
    },
    {
      "id": "t:refill",
      "label": "Refill-Eligible Likes",
      "bind_id": "t:root",
      "capabilities": {
        "refill": true
      },
      "service_id": 167
    },
    {
      "id": "t:retention",
      "label": "Retention",
      "bind_id": "t:root",
      "service_id": 203
    },
    {
      "id": "t:priority",
      "label": "Priority Delivery",
      "bind_id": "t:root",
      "service_id": 178
    },
    {
      "id": "t:controlled",
      "label": "Controlled-Speed Likes",
      "bind_id": "t:root",
      "service_id": 325
    },
    {
      "id": "t:bundle",
      "label": "Combined Engagement",
      "bind_id": "t:root",
      "service_id": 193
    },
    {
      "id": "t:bundle_controlled",
      "label": "Controlled Likes + Impressions",
      "bind_id": "t:root",
      "service_id": 331
    },
    {
      "id": "t:account",
      "label": "Account Type",
      "bind_id": "t:root",
      "service_id": 1152
    },
    {
      "id": "t:power",
      "label": "POWER-Labeled Likes",
      "bind_id": "t:root",
      "service_id": 690
    }
  ],
  "fields": [
    {
      "id": "f:link",
      "type": "text",
      "label": "Instagram Post URL",
      "bind_id": "t:root",
      "name": "link",
      "required": true,
      "description": "Link to the Instagram post to receive Likes."
    },
    {
      "id": "f:quantity",
      "type": "number",
      "label": "Quantity",
      "bind_id": "t:root",
      "name": "quantity",
      "required": true,
      "defaults": {
        "placeholder": "e.g. 100",
        "tags": [
          {
            "label": "Min: {preview.min ?? \"—\"}"
          },
          {
            "label": "Max: {preview.max ?? \"—\"}"
          }
        ]
      },
      "description": "The number of Likes requested for this order.",
      "pricing_role": "base",
      "quantity": {
        "value_by": "value",
        "multiply": 1
      }
    },
    {
      "id": "f:drip_feed",
      "type": "toggle",
      "label": "Drip feed",
      "bind_id": "t:root",
      "name": "drip_feed",
      "required": false,
      "description": "Deliver the order in multiple runs.",
      "button": true,
      "visibility_expression": {
        "language": "javascript",
        "body": "preview.service_context.length > 0 && preview.service_context.every(service => service.capabilities?.dripfeed?.enabled === true)"
      }
    },
    {
      "id": "f:runs",
      "type": "number",
      "label": "Runs",
      "name": "runs",
      "required": true,
      "defaults": {
        "placeholder": "e.g. 5"
      },
      "description": "Number of deliveries in the drip-feed schedule."
    },
    {
      "id": "f:interval",
      "type": "number",
      "label": "Interval (minutes)",
      "name": "interval",
      "required": true,
      "defaults": {
        "placeholder": "e.g. 60"
      },
      "description": "Minutes between each drip-feed run."
    },
    {
      "id": "f:quality",
      "type": "select",
      "variant": "default",
      "label": "Quality label",
      "bind_id": "t:quality",
      "required": true,
      "options": [
        {
          "id": "o:quality:hq",
          "label": "HQ-labeled Likes",
          "value": "hq",
          "service_id": 136
        }
      ]
    },
    {
      "id": "f:bot",
      "type": "select",
      "variant": "default",
      "label": "Bot Likes type",
      "bind_id": "t:bot",
      "required": true,
      "options": [
        {
          "id": "o:bot:standard",
          "label": "Bot Likes",
          "value": "bot_likes",
          "service_id": 224
        },
        {
          "id": "o:bot:profile_posts",
          "label": "Bots with profile pictures and posts",
          "value": "profile_pictures_posts",
          "service_id": 1181
        }
      ]
    },
    {
      "id": "f:target",
      "type": "select",
      "variant": "default",
      "label": "Location",
      "bind_id": "t:target",
      "required": true,
      "options": [
        {
          "id": "o:target:usa",
          "label": "USA",
          "value": "usa",
          "service_id": 275
        },
        {
          "id": "o:target:brazil",
          "label": "Brazil",
          "value": "brazil",
          "service_id": 276
        },
        {
          "id": "o:target:india",
          "label": "India",
          "value": "india",
          "service_id": 285
        },
        {
          "id": "o:target:korea",
          "label": "Korea",
          "value": "korea",
          "service_id": 289
        },
        {
          "id": "o:target:egypt",
          "label": "Egypt",
          "value": "egypt",
          "service_id": 280
        },
        {
          "id": "o:target:ksa",
          "label": "Saudi Arabia (KSA)",
          "value": "ksa",
          "service_id": 281
        },
        {
          "id": "o:target:arab",
          "label": "Arab",
          "value": "arab",
          "service_id": 279
        },
        {
          "id": "o:target:uae_arab",
          "label": "UAE / Arab",
          "value": "uae_arab",
          "service_id": 283
        },
        {
          "id": "o:target:arab_gulf",
          "label": "Arab Gulf",
          "value": "arab_gulf",
          "service_id": 323
        },
        {
          "id": "o:target:iran",
          "label": "Iran",
          "value": "iran",
          "service_id": 287
        },
        {
          "id": "o:target:arab_iran",
          "label": "Arab / Iran mix",
          "value": "arab_iran",
          "service_id": 288
        },
        {
          "id": "o:target:arab_india_turkey",
          "label": "Arab / India / Turkey mix",
          "value": "arab_india_turkey",
          "service_id": 282
        },
        {
          "id": "o:target:uk",
          "label": "United Kingdom",
          "value": "uk",
          "service_id": 295
        },
        {
          "id": "o:target:spain",
          "label": "Spain",
          "value": "spain",
          "service_id": 297
        },
        {
          "id": "o:target:taiwan",
          "label": "Taiwan",
          "value": "taiwan",
          "service_id": 298
        },
        {
          "id": "o:target:hong_kong",
          "label": "Hong Kong",
          "value": "hong_kong",
          "service_id": 306
        },
        {
          "id": "o:target:ukraine",
          "label": "Ukraine",
          "value": "ukraine",
          "service_id": 307
        },
        {
          "id": "o:target:nigeria",
          "label": "Nigeria",
          "value": "nigeria",
          "service_id": 314
        },
        {
          "id": "o:target:china",
          "label": "China",
          "value": "china",
          "service_id": 320
        },
        {
          "id": "o:target:japan",
          "label": "Japan",
          "value": "japan",
          "service_id": 321
        },
        {
          "id": "o:target:africa",
          "label": "Africa (regional label)",
          "value": "africa",
          "service_id": 322
        },
        {
          "id": "o:target:usa_algorithm",
          "label": "USA Likes — “Algorithm Tricking” source label",
          "value": "usa_algorithm_tricking",
          "service_id": 1323
        },
        {
          "id": "o:target:usa_raU",
          "label": "USA Likes — RAU source label",
          "value": "usa_rau",
          "service_id": 689
        },
        {
          "id": "o:target:usa_non_drop",
          "label": "USA Likes — non-drop source label",
          "value": "usa_non_drop",
          "service_id": 691
        }
      ]
    },
    {
      "id": "f:gender",
      "type": "select",
      "variant": "default",
      "label": "Audience",
      "bind_id": "t:gender",
      "required": true,
      "options": [
        {
          "id": "o:gender:india_women",
          "label": "Women — India",
          "value": "women_india",
          "service_id": 292
        },
        {
          "id": "o:gender:female_gulf",
          "label": "Female — Arab Gulf",
          "value": "female_arab_gulf",
          "service_id": 324
        },
        {
          "id": "o:gender:male_gulf",
          "label": "Male — Arab Gulf",
          "value": "male_arab_gulf",
          "service_id": 296
        },
        {
          "id": "o:gender:male_usa_afro",
          "label": "Male — USA (Afro-American)",
          "value": "male_usa_afro",
          "service_id": 318
        },
        {
          "id": "o:gender:female_usa_afro",
          "label": "Female — USA (Afro-American)",
          "value": "female_usa_afro",
          "service_id": 319
        },
        {
          "id": "o:gender:female_engagement",
          "label": "Female Engagement Booster (source label)",
          "value": "female_engagement_booster",
          "service_id": 693
        }
      ]
    },
    {
      "id": "f:refill",
      "type": "select",
      "variant": "default",
      "label": "Refill",
      "bind_id": "t:refill",
      "required": true,
      "options": [
        {
          "id": "o:refill:30d",
          "label": "30-day refill (source label)",
          "value": "30d",
          "service_id": 167
        }
      ]
    },
    {
      "id": "f:retention",
      "type": "select",
      "variant": "default",
      "label": "Retention claim",
      "bind_id": "t:retention",
      "required": true,
      "options": [
        {
          "id": "o:retention:non_drop",
          "label": "Non-drop (source label)",
          "value": "non_drop",
          "service_id": 203
        },
        {
          "id": "o:retention:low_drop",
          "label": "Low drops (source label)",
          "value": "low_drop",
          "service_id": 157
        },
        {
          "id": "o:retention:drops_5_7",
          "label": "Estimated 5–7% drops (source label)",
          "value": "drops_5_7",
          "service_id": 186
        }
      ]
    },
    {
      "id": "f:priority",
      "type": "select",
      "variant": "default",
      "label": "Delivery",
      "bind_id": "t:priority",
      "required": true,
      "options": [
        {
          "id": "o:priority:instant",
          "label": "Instant (source label)",
          "value": "instant",
          "service_id": 178
        },
        {
          "id": "o:priority:emergency",
          "label": "Emergency (source label)",
          "value": "emergency",
          "service_id": 205
        },
        {
          "id": "o:priority:fast",
          "label": "Fast (source label)",
          "value": "fast",
          "service_id": 208
        },
        {
          "id": "o:priority:2_5k_day",
          "label": "2–5K per day (source wording)",
          "value": "2_5k_per_day",
          "service_id": 698
        }
      ]
    },
    {
      "id": "f:controlled",
      "type": "select",
      "variant": "default",
      "label": "Delivery rate",
      "bind_id": "t:controlled",
      "required": true,
      "options": [
        {
          "id": "o:controlled:1_min",
          "label": "1 Like per minute",
          "value": "1_per_minute",
          "service_id": 325
        },
        {
          "id": "o:controlled:5_min",
          "label": "5 Likes per minute",
          "value": "5_per_minute",
          "service_id": 326
        },
        {
          "id": "o:controlled:10_min",
          "label": "10 Likes per minute",
          "value": "10_per_minute",
          "service_id": 327
        },
        {
          "id": "o:controlled:25_min",
          "label": "25 Likes per minute",
          "value": "25_per_minute",
          "service_id": 328
        },
        {
          "id": "o:controlled:50_min",
          "label": "50 Likes per minute",
          "value": "50_per_minute",
          "service_id": 329
        },
        {
          "id": "o:controlled:60_min",
          "label": "60 Likes per minute",
          "value": "60_per_minute",
          "service_id": 330
        }
      ]
    },
    {
      "id": "f:bundle",
      "type": "select",
      "variant": "default",
      "label": "Engagement bundle",
      "bind_id": "t:bundle",
      "required": true,
      "options": [
        {
          "id": "o:bundle:impressions",
          "label": "Likes + Impressions",
          "value": "likes_impressions",
          "service_id": 193
        },
        {
          "id": "o:bundle:reach",
          "label": "Likes + Impressions + Reach",
          "value": "likes_impressions_reach",
          "service_id": 180
        }
      ]
    },
    {
      "id": "f:bundle_controlled",
      "type": "select",
      "variant": "default",
      "label": "Delivery rate",
      "bind_id": "t:bundle_controlled",
      "required": true,
      "options": [
        {
          "id": "o:bundle_controlled:1_min",
          "label": "1 Like per minute + Impressions",
          "value": "1_per_minute_impressions",
          "service_id": 331
        },
        {
          "id": "o:bundle_controlled:5_min",
          "label": "5 Likes per minute + Impressions",
          "value": "5_per_minute_impressions",
          "service_id": 332
        },
        {
          "id": "o:bundle_controlled:10_min",
          "label": "10 Likes per minute + Impressions",
          "value": "10_per_minute_impressions",
          "service_id": 333
        },
        {
          "id": "o:bundle_controlled:25_min",
          "label": "25 Likes per minute + Impressions",
          "value": "25_per_minute_impressions",
          "service_id": 334
        },
        {
          "id": "o:bundle_controlled:50_min",
          "label": "50 Likes per minute + Impressions",
          "value": "50_per_minute_impressions",
          "service_id": 335
        },
        {
          "id": "o:bundle_controlled:60_min",
          "label": "60 Likes per minute + Impressions",
          "value": "60_per_minute_impressions",
          "service_id": 336
        }
      ]
    },
    {
      "id": "f:verified",
      "type": "select",
      "variant": "default",
      "label": "Account type",
      "bind_id": "t:account",
      "required": true,
      "options": [
        {
          "id": "o:account:verified",
          "label": "Likes from verified accounts (source label)",
          "value": "verified_accounts",
          "service_id": 1152
        }
      ]
    },
    {
      "id": "f:power",
      "type": "select",
      "variant": "default",
      "label": "POWER label",
      "bind_id": "t:power",
      "required": true,
      "options": [
        {
          "id": "o:power:top_market",
          "label": "POWER Likes — “Top in Market” source label",
          "value": "power_top_in_market",
          "service_id": 690
        },
        {
          "id": "o:power:perfect_quality",
          "label": "POWER Likes — “Perfect Quality” source label",
          "value": "power_perfect_quality",
          "service_id": 701
        },
        {
          "id": "o:power:unqualified",
          "label": "POWER Likes",
          "value": "power_likes",
          "service_id": 703
        }
      ]
    }
  ],
  "order_for_tags": {
    "t:quality": [
      "f:quality"
    ],
    "t:bot": [
      "f:bot"
    ],
    "t:target": [
      "f:target"
    ],
    "t:gender": [
      "f:gender"
    ],
    "t:refill": [
      "f:refill"
    ],
    "t:retention": [
      "f:retention"
    ],
    "t:priority": [
      "f:priority"
    ],
    "t:controlled": [
      "f:controlled"
    ],
    "t:bundle": [
      "f:bundle"
    ],
    "t:bundle_controlled": [
      "f:bundle_controlled"
    ],
    "t:account": [
      "f:verified"
    ],
    "t:power": [
      "f:power"
    ]
  },
  "includes_for_buttons": {
    "f:drip_feed": [
      "f:runs",
      "f:interval"
    ]
  },
  "excludes_for_buttons": {},
  "option_effects_for_buttons": {},
  "value_effects_for_triggers": {},
  "schema_version": "1",
  "fallbacks": {
    "nodes": {
      "t:standard": [
        127,
        129
      ],
      "o:bot:standard": [
        236
      ],
      "o:bot:profile_posts": [
        1182
      ],
      "o:target:brazil": [
        277
      ],
      "o:target:india": [
        286
      ],
      "o:refill:30d": [
        149
      ],
      "o:bundle:impressions": [
        174
      ],
      "o:power:top_market": [
        699
      ],
      "o:target:usa_algorithm": [
        46
      ],
      "o:gender:female_engagement": [
        692
      ]
    },
    "global": {}
  },
  "description": "Instagram Likes with evidenced account, audience, delivery, retention, and engagement variants.",
  "notices": [],
  "meta": {}
} satisfies ProductDefinition;
