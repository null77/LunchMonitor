import { describe, test, expect } from "bun:test";
import {
  LunchMonitorConfigSchema,
  AlertPolicySchema,
  ThresholdConfigSchema,
  createDefaultConfig,
  createEmptyAlertState,
} from "./schema";

describe("ThresholdConfigSchema", () => {
  test("validates percentage threshold", () => {
    const result = ThresholdConfigSchema.safeParse({
      type: "percentage",
      operator: "gte",
      value: 80,
    });
    expect(result.success).toBe(true);
  });

  test("validates absolute threshold", () => {
    const result = ThresholdConfigSchema.safeParse({
      type: "absolute",
      operator: "gt",
      value: 500,
    });
    expect(result.success).toBe(true);
  });

  test("rejects negative values", () => {
    const result = ThresholdConfigSchema.safeParse({
      type: "percentage",
      operator: "gte",
      value: -10,
    });
    expect(result.success).toBe(false);
  });

  test("accepts optional message", () => {
    const result = ThresholdConfigSchema.safeParse({
      type: "percentage",
      operator: "gte",
      value: 100,
      message: "Budget exceeded!",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("Budget exceeded!");
    }
  });
});

describe("AlertPolicySchema", () => {
  test("validates complete policy", () => {
    const policy = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Policy",
      enabled: true,
      scope: { type: "global" },
      thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
      channels: ["email"],
    };
    const result = AlertPolicySchema.safeParse(policy);
    expect(result.success).toBe(true);
  });

  test("rejects policy without thresholds", () => {
    const policy = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Policy",
      enabled: true,
      scope: { type: "global" },
      thresholds: [],
      channels: ["email"],
    };
    const result = AlertPolicySchema.safeParse(policy);
    expect(result.success).toBe(false);
  });

  test("rejects policy without channels", () => {
    const policy = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Policy",
      enabled: true,
      scope: { type: "global" },
      thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
      channels: [],
    };
    const result = AlertPolicySchema.safeParse(policy);
    expect(result.success).toBe(false);
  });

  test("validates category scope with IDs", () => {
    const policy = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Category Policy",
      enabled: true,
      scope: { type: "category", categoryIds: [1, 2, 3] },
      thresholds: [{ type: "percentage", operator: "gte", value: 80 }],
      channels: ["email", "sms"],
    };
    const result = AlertPolicySchema.safeParse(policy);
    expect(result.success).toBe(true);
  });
});

describe("LunchMonitorConfigSchema", () => {
  test("validates minimal config", () => {
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "test-token" },
      notifications: {},
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };
    const result = LunchMonitorConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test("rejects wrong version", () => {
    const config = {
      version: "2.0",
      lunchmoney: { apiToken: "test-token" },
      notifications: {},
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };
    const result = LunchMonitorConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  test("validates full config with email", () => {
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "test-token" },
      notifications: {
        email: {
          enabled: true,
          smtp: {
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: { user: "test@example.com", pass: "password" },
          },
          from: "Test <test@example.com>",
          to: ["recipient@example.com"],
        },
      },
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "America/New_York" },
    };
    const result = LunchMonitorConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe("createDefaultConfig", () => {
  test("creates valid config", () => {
    const config = createDefaultConfig();
    const result = LunchMonitorConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  test("has one default policy", () => {
    const config = createDefaultConfig();
    expect(config.policies.length).toBe(1);
    expect(config.policies[0].name).toBe("Default Budget Alert");
  });

  test("default policy has 80% and 100% thresholds", () => {
    const config = createDefaultConfig();
    const thresholds = config.policies[0].thresholds;
    expect(thresholds.length).toBe(2);
    expect(thresholds[0].value).toBe(80);
    expect(thresholds[1].value).toBe(100);
  });
});

describe("createEmptyAlertState", () => {
  test("creates valid state", () => {
    const state = createEmptyAlertState();
    expect(state.triggeredAlerts).toEqual([]);
    expect(state.lastChecked).toBeDefined();
  });

  test("lastChecked is valid ISO date", () => {
    const state = createEmptyAlertState();
    const date = new Date(state.lastChecked);
    expect(date.getTime()).not.toBeNaN();
  });
});
