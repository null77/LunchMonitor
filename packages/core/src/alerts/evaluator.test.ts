import { describe, test, expect } from "bun:test";
import {
  evaluateBudgets,
  alertsToNotifications,
  updateAlertState,
} from "./evaluator";
import type { LunchMonitorConfig, AlertState } from "../config/schema";
import type { Budget } from "../api/types";

// Helper to create a budget
const createBudget = (
  id: number,
  name: string,
  budgetAmount: number,
  spentAmount: number,
  options: Partial<Budget> = {}
): Budget => ({
  category_name: name,
  category_id: id,
  category_group_name: null,
  group_id: null,
  is_group: false,
  is_income: false,
  exclude_from_budget: false,
  exclude_from_totals: false,
  data: [
    {
      budget_month: "2024-01-01",
      budget_to_base: budgetAmount,
      budget_amount: budgetAmount,
      budget_currency: "USD",
      spending_to_base: spentAmount,
      num_transactions: 5,
    },
  ],
  config: null,
  order: 0,
  archived: false,
  recurring: null,
  ...options,
});

// Helper to create config
const createConfig = (policies: LunchMonitorConfig["policies"] = []): LunchMonitorConfig => ({
  version: "1.0",
  lunchmoney: { apiToken: "test" },
  notifications: {},
  policies,
  settings: { checkIntervalMinutes: 360, timezone: "UTC" },
});

// Helper to create empty state
const createState = (): AlertState => ({
  lastChecked: new Date().toISOString(),
  triggeredAlerts: [],
});

describe("evaluateBudgets", () => {
  test("triggers alert at 80% threshold", () => {
    const budgets = [createBudget(1, "Food", 10000, 8500)]; // 85% used
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(1);
    expect(result.triggeredAlerts[0].categoryName).toBe("Food");
    expect(result.triggeredAlerts[0].percentUsed).toBeCloseTo(85);
  });

  test("does not trigger below threshold", () => {
    const budgets = [createBudget(1, "Food", 10000, 7000)]; // 70% used
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
  });

  test("triggers multiple thresholds", () => {
    const budgets = [createBudget(1, "Food", 10000, 10500)]; // 105% used
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [
          { type: "percentage", operator: "gte", value: 80 },
          { type: "percentage", operator: "gte", value: 100 },
        ],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(1);
    expect(result.triggeredAlerts[0].thresholds.length).toBe(2);
  });

  test("skips income categories", () => {
    const budgets = [
      createBudget(1, "Salary", 10000, 15000, { is_income: true }),
    ];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
  });

  test("skips excluded from budget categories", () => {
    const budgets = [
      createBudget(1, "Excluded", 10000, 15000, { exclude_from_budget: true }),
    ];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
  });

  test("skips archived categories", () => {
    const budgets = [
      createBudget(1, "Archived", 10000, 15000, { archived: true }),
    ];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
  });

  test("respects category scope", () => {
    const budgets = [
      createBudget(1, "Food", 10000, 9000),
      createBudget(2, "Entertainment", 10000, 9000),
    ];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Food Only",
        enabled: true,
        scope: { type: "category", categoryIds: [1] },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(1);
    expect(result.triggeredAlerts[0].categoryName).toBe("Food");
  });

  test("respects exclude categories in global scope", () => {
    const budgets = [
      createBudget(1, "Food", 10000, 9000),
      createBudget(2, "Entertainment", 10000, 9000),
    ];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Exclude Entertainment",
        enabled: true,
        scope: { type: "global", excludeCategories: [2] },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(1);
    expect(result.triggeredAlerts[0].categoryName).toBe("Food");
  });

  test("skips disabled policies", () => {
    const budgets = [createBudget(1, "Food", 10000, 9000)];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Disabled",
        enabled: false,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
  });

  test("skips categories without budget", () => {
    const budgets = [createBudget(1, "No Budget", 0, 5000)];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
    const state = createState();

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
  });

  test("handles cooldown once_per_threshold", () => {
    const budgets = [createBudget(1, "Food", 10000, 8500)];
    const config = createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        enabled: true,
        scope: { type: "global" },
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
        cooldown: { type: "once_per_threshold" },
      },
    ]);
    const state: AlertState = {
      lastChecked: new Date().toISOString(),
      triggeredAlerts: [
        {
          policyId: "550e8400-e29b-41d4-a716-446655440000",
          categoryId: 1,
          thresholdValue: 80,
          triggeredAt: new Date().toISOString(),
        },
      ],
    };

    const result = evaluateBudgets(budgets, config, state);

    expect(result.triggeredAlerts.length).toBe(0);
    expect(result.skippedDueToCooldown.length).toBe(1);
  });
});

describe("evaluateBudgets with category groups", () => {
  const policy = (scope: LunchMonitorConfig["policies"][number]["scope"]) =>
    createConfig([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Groups",
        enabled: true,
        scope,
        thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
        channels: ["email"],
      },
    ]);
  const group = createBudget(10, "Food", 500, 450, { is_group: true });
  const child = createBudget(11, "Groceries", 500, 450, { group_id: 10, category_group_name: "Food" });
  const unbudgetedChild = createBudget(12, "Dining", 0, 30, { group_id: 10 });

  test("global policy alerts on the child, not also its group", () => {
    const result = evaluateBudgets([group, child], policy({ type: "global" }), createState());
    expect(result.triggeredAlerts.map((a) => a.categoryId)).toEqual([11]);
  });

  test("global policy alerts on a group budgeted only at group level", () => {
    const result = evaluateBudgets([group, unbudgetedChild], policy({ type: "global" }), createState());
    expect(result.triggeredAlerts.map((a) => a.categoryId)).toEqual([10]);
  });

  test("an explicit category policy can still target the group", () => {
    const result = evaluateBudgets([group, child], policy({ type: "category", categoryIds: [10] }), createState());
    expect(result.triggeredAlerts.map((a) => a.categoryId)).toEqual([10]);
  });
});

describe("alertsToNotifications", () => {
  test("converts alert to notification", () => {
    const alerts = [
      {
        policy: {
          id: "test-id",
          name: "Test Policy",
          enabled: true,
          scope: { type: "global" as const },
          thresholds: [],
          channels: ["email" as const],
        },
        budget: createBudget(1, "Food", 10000, 8500),
        categoryId: 1,
        categoryName: "Food",
        budgetAmount: 10000,
        spentAmount: 8500,
        percentUsed: 85,
        remaining: 1500,
        thresholds: [
          {
            threshold: { type: "percentage" as const, operator: "gte" as const, value: 80 },
            actualValue: 85,
            percentUsed: 85,
          },
        ],
      },
    ];

    const notifications = alertsToNotifications(alerts);

    expect(notifications.length).toBe(1);
    expect(notifications[0].categoryName).toBe("Food");
    expect(notifications[0].percentUsed).toBe(85);
    expect(notifications[0].highestThreshold).toBe(80);
    expect(notifications[0].channels).toEqual(["email"]);
  });

  test("uses custom message when provided", () => {
    const alerts = [
      {
        policy: {
          id: "test-id",
          name: "Test Policy",
          enabled: true,
          scope: { type: "global" as const },
          thresholds: [],
          channels: ["email" as const],
        },
        budget: createBudget(1, "Food", 10000, 8500),
        categoryId: 1,
        categoryName: "Food",
        budgetAmount: 10000,
        spentAmount: 8500,
        percentUsed: 85,
        remaining: 1500,
        thresholds: [
          {
            threshold: {
              type: "percentage" as const,
              operator: "gte" as const,
              value: 80,
              message: "Custom warning message!",
            },
            actualValue: 85,
            percentUsed: 85,
          },
        ],
      },
    ];

    const notifications = alertsToNotifications(alerts);

    expect(notifications[0].message).toBe("Custom warning message!");
  });
});

describe("updateAlertState", () => {
  test("adds new triggered alerts", () => {
    const state = createState();
    const alerts = [
      {
        policy: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Test",
          enabled: true,
          scope: { type: "global" as const },
          thresholds: [],
          channels: ["email" as const],
        },
        budget: createBudget(1, "Food", 10000, 8500),
        categoryId: 1,
        categoryName: "Food",
        budgetAmount: 10000,
        spentAmount: 8500,
        percentUsed: 85,
        remaining: 1500,
        thresholds: [
          {
            threshold: { type: "percentage" as const, operator: "gte" as const, value: 80 },
            actualValue: 85,
            percentUsed: 85,
          },
        ],
      },
    ];

    const newState = updateAlertState(state, alerts);

    expect(newState.triggeredAlerts.length).toBe(1);
    expect(newState.triggeredAlerts[0].policyId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(newState.triggeredAlerts[0].categoryId).toBe(1);
    expect(newState.triggeredAlerts[0].thresholdValue).toBe(80);
  });

  test("preserves existing alerts from current month", () => {
    const now = new Date();
    const state: AlertState = {
      lastChecked: now.toISOString(),
      triggeredAlerts: [
        {
          policyId: "existing",
          categoryId: 2,
          thresholdValue: 100,
          triggeredAt: now.toISOString(),
        },
      ],
    };

    const newState = updateAlertState(state, []);

    expect(newState.triggeredAlerts.length).toBe(1);
    expect(newState.triggeredAlerts[0].policyId).toBe("existing");
  });
});
