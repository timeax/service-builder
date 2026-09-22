// SPDX-License-Identifier: GPL-3.0-only
import type { HandlerService } from "@elqora/dgp-spec";

export const services16 = [
  {
    "id": "3880",
    "name": "Instagram Followers [Refill: 30 Days] [Max: 50K] [Start Time: 1 Hour] [Speed: 500/Hour]",
    "description": null,
    "category": "Instagram Followers [BOTS with REFILL] [CAN FULLY DROP]",
    "rate": 4.625,
    "min": 10,
    "max": 1000000,
    "capabilities": {
      "refill": {
        "id": "refill",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "cancel": {
        "id": "cancel",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "dripfeed": {
        "id": "dripfeed",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "contract": {
        "id": "contract",
        "enabled": false,
        "description": null,
        "meta": {}
      }
    },
    "meta": {
      "catalog_record_id": 211,
      "handler_service_id": 1193,
      "handler_id": 1,
      "handler_name": "Server 1"
    },
    "state": "enabled",
    "state_reason": null
  },
  {
    "id": "7453",
    "name": "Instagram Followers [Refill: 30 Days] [Max: 1M] [Start Time: 0-1 Hour] [Speed: 500K/Day]",
    "description": null,
    "category": "Instagram Followers [BOTS with REFILL] [CAN FULLY DROP]",
    "rate": 1.0385,
    "min": 10,
    "max": 10000000,
    "capabilities": {
      "refill": {
        "id": "refill",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "cancel": {
        "id": "cancel",
        "enabled": true,
        "description": null,
        "meta": {}
      },
      "dripfeed": {
        "id": "dripfeed",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "contract": {
        "id": "contract",
        "enabled": false,
        "description": null,
        "meta": {}
      }
    },
    "meta": {
      "catalog_record_id": 200,
      "handler_service_id": 1194,
      "handler_id": 1,
      "handler_name": "Server 1"
    },
    "state": "enabled",
    "state_reason": null
  },
  {
    "id": "7454",
    "name": "Instagram Followers [Refill: 365 Days] [Max: 1M] [Start Time: 0-1 Hour] [Speed: 300K/Day]",
    "description": null,
    "category": "Instagram Followers [BOTS with REFILL] [CAN FULLY DROP]",
    "rate": 1.0875,
    "min": 10,
    "max": 10000000,
    "capabilities": {
      "refill": {
        "id": "refill",
        "enabled": true,
        "description": null,
        "meta": {}
      },
      "cancel": {
        "id": "cancel",
        "enabled": true,
        "description": null,
        "meta": {}
      },
      "dripfeed": {
        "id": "dripfeed",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "contract": {
        "id": "contract",
        "enabled": false,
        "description": null,
        "meta": {}
      }
    },
    "meta": {
      "catalog_record_id": 239,
      "handler_service_id": 1195,
      "handler_id": 1,
      "handler_name": "Server 1"
    },
    "state": "enabled",
    "state_reason": null
  },
  {
    "id": "3881",
    "name": "Instagram Followers [Refill: 30 Days] [Max: 100K] [Start Time: 1 Hour] [Speed: 500/Hour]",
    "description": null,
    "category": "Instagram Followers [BOTS with REFILL] [CAN FULLY DROP]",
    "rate": 4.625,
    "min": 10,
    "max": 1000000,
    "capabilities": {
      "refill": {
        "id": "refill",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "cancel": {
        "id": "cancel",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "dripfeed": {
        "id": "dripfeed",
        "enabled": false,
        "description": null,
        "meta": {}
      },
      "contract": {
        "id": "contract",
        "enabled": false,
        "description": null,
        "meta": {}
      }
    },
    "meta": {
      "catalog_record_id": 194,
      "handler_service_id": 1196,
      "handler_id": 1,
      "handler_name": "Server 1"
    },
    "state": "enabled",
    "state_reason": null
  }
] as const satisfies readonly HandlerService[];
