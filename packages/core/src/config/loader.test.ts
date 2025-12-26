import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  validateConfig,
  getDefaultConfigPath,
  getDefaultStatePath,
} from "./loader";

describe("validateConfig", () => {
  test("returns valid for correct config", () => {
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "test" },
      notifications: {},
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.errors).toBeUndefined();
  });

  test("returns errors for invalid config", () => {
    const config = {
      version: "2.0", // Invalid version
      lunchmoney: { apiToken: "test" },
      notifications: {},
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test("returns errors for missing required fields", () => {
    const config = {
      version: "1.0",
      // Missing lunchmoney
      notifications: {},
      policies: [],
      settings: {},
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
  });

  test("validates email config structure", () => {
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "test" },
      notifications: {
        email: {
          enabled: true,
          smtp: {
            host: "smtp.example.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "pass" },
          },
          from: "test@example.com",
          to: ["recipient@example.com"],
        },
      },
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
  });

  test("rejects invalid email recipients", () => {
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "test" },
      notifications: {
        email: {
          enabled: true,
          smtp: {
            host: "smtp.example.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "pass" },
          },
          from: "test@example.com",
          to: [], // Empty recipients
        },
      },
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
  });
});

describe("loadConfig", () => {
  const testDir = join(tmpdir(), `lunchmonitor-test-${Date.now()}`);
  const testConfigPath = join(testDir, "config.json");

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("loads valid config file", async () => {
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "test-token" },
      notifications: {},
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    const loaded = await loadConfig(testConfigPath);

    expect(loaded.version).toBe("1.0");
    expect(loaded.lunchmoney.apiToken).toBe("test-token");
  });

  test("substitutes environment variables", async () => {
    process.env.TEST_API_TOKEN = "env-token-value";
    const config = {
      version: "1.0",
      lunchmoney: { apiToken: "${TEST_API_TOKEN}" },
      notifications: {},
      policies: [],
      settings: { checkIntervalMinutes: 360, timezone: "UTC" },
    };
    await writeFile(testConfigPath, JSON.stringify(config));

    const loaded = await loadConfig(testConfigPath);

    expect(loaded.lunchmoney.apiToken).toBe("env-token-value");

    delete process.env.TEST_API_TOKEN;
  });

  test("throws on invalid config", async () => {
    const config = { invalid: true };
    await writeFile(testConfigPath, JSON.stringify(config));

    await expect(loadConfig(testConfigPath)).rejects.toThrow();
  });

  test("throws on file not found", async () => {
    await expect(loadConfig("/nonexistent/path/config.json")).rejects.toThrow();
  });

  test("throws on invalid JSON", async () => {
    await writeFile(testConfigPath, "not valid json {{{");

    await expect(loadConfig(testConfigPath)).rejects.toThrow();
  });
});

describe("getDefaultConfigPath", () => {
  test("returns path containing lunchmonitor", () => {
    const path = getDefaultConfigPath();
    expect(path).toContain("lunchmonitor");
    expect(path).toContain("config.json");
  });
});

describe("getDefaultStatePath", () => {
  test("returns path containing lunchmonitor", () => {
    const path = getDefaultStatePath();
    expect(path).toContain("lunchmonitor");
    expect(path).toContain("state.json");
  });
});
