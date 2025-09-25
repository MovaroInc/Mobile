export const plans = {
  currency: 'USD',
  tiers: [
    {
      "id": "startup",
      "label": "Startup",
      "description": "Small teams getting rolling",
      "plans": [
        {
          "id": "startup-1",
          "name": "Tier 1",
          "drivers": { "min": 1, "max": 3 },
          "stopsPerMonth": 900,
          "monthly": 124.99,
          "avgStopsPerDriverPerMonth": 450,
          "perStop": 0.138,
          "stopsPerDriverPerDay": { "min": 10, "max": 30 },
          "annual": 1199.99,
          "addonStops": 14.99
        },
        {
          "id": "startup-2",
          "name": "Tier 2",
          "drivers": { "min": 4, "max": 6 },
          "stopsPerMonth": 2400,
          "monthly": 249.99,
          "avgStopsPerDriverPerMonth": 480,
          "perStop": 0.104,
          "stopsPerDriverPerDay": { "min": 13, "max": 20 },
          "annual": 2399.99
        },
        {
          "id": "startup-3",
          "name": "Tier 3",
          "drivers": { "min": 7, "max": 9 },
          "stopsPerMonth": 4200,
          "monthly": 349.99,
          "avgStopsPerDriverPerMonth": 525,
          "perStop": 0.095,
          "stopsPerDriverPerDay": { "min": 15, "max": 20 },
          "annual": 3359.99
        }
      ]
    },
    {
      "id": "growth",
      "label": "Growth",
      "description": "Scaling teams with rising volume",
      "plans": [
        {
          "id": "growth-1",
          "name": "Tier 1",
          "drivers": { "min": 10, "max": 14 },
          "stopsPerMonth": 5800,
          "monthly": 549.99,
          "avgStopsPerDriverPerMonth": 483,
          "perStop": 0.095,
          "annual": 5279.99,
          "stopsPerDriverPerDay": { "min": 14, "max": 20 },
        },
        {
          "id": "growth-2",
          "name": "Tier 2",
          "drivers": { "min": 15, "max": 19 },
          "stopsPerMonth": 7900,
          "monthly": 749.99,
          "avgStopsPerDriverPerMonth": 459,
          "perStop": 0.096,
          "annual": 7199.99,
          "stopsPerDriverPerDay": { "min": 14, "max": 19 },
        },
        {
          "id": "growth-3",
          "name": "Tier 3",
          "drivers": { "min": 20, "max": 24 },
          "stopsPerMonth": 9800,
          "monthly": 899.99,
          "avgStopsPerDriverPerMonth": 445,
          "perStop": 0.092,
          "annual": 8639.99,
          "stopsPerDriverPerDay": { "min": 13, "max": 16 },
        },
        {
          "id": "growth-4",
          "name": "Tier 4",
          "drivers": { "min": 25, "max": 28 },
          "stopsPerMonth": 11500,
          "monthly": 999.99,
          "avgStopsPerDriverPerMonth": 434,
          "perStop": 0.087,
          "annual": 9599.99,
          "stopsPerDriverPerDay": { "min": 13, "max": 16 },
        }
      ]
    },
    {
      "id": "enterprise",
      "label": "Enterprise",
      "description": "High volume operations",
      "plans": [
        {
          "id": "enterprise-1",
          "name": "Tier 1",
          "drivers": { "min": 30, "max": 34 },
          "stopsPerMonth": 13200,
          "monthly": 1249.99,
          "avgStopsPerDriverPerMonth": 394,
          "perStop": 0.102,
          "annual": 12999.99,
          "stopsPerDriverPerDay": { "min": 13, "max": 16 },
        },
        {
          "id": "enterprise-2",
          "name": "Tier 2",
          "drivers": { "min": 35, "max": 39 },
          "stopsPerMonth": 15000,
          "monthly": 1699.99,
          "avgStopsPerDriverPerMonth": 397,
          "perStop": 0.116,
          "annual": 16299.99,
          "stopsPerDriverPerDay": { "min": 13, "max": 16 },
        },
        {
          "id": "enterprise-3",
          "name": "Tier 3",
          "drivers": { "min": 40, "max": 45 },
          "stopsPerMonth": 17500,
          "monthly": 2099.99,
          "avgStopsPerDriverPerMonth": 419,
          "perStop": 0.118,
          "annual": 20199.99,
          "stopsPerDriverPerDay": { "min": 13, "max": 16 },
        },
        {
          "id": "enterprise-4",
          "name": "Tier 4",
          "drivers": { "min": 46, "max": 50 },
          "stopsPerMonth": 20000,
          "monthly": 2699.99,
          "avgStopsPerDriverPerMonth": 438,
          "perStop": 0.129,
          "annual": 25999.99,
          "stopsPerDriverPerDay": { "min": 13, "max": 16 },
        }
      ]
    }
  ]
}
