import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  LunchMonitorConfigSchema,
  AlertStateSchema,
  createEmptyAlertState,
  type LunchMonitorConfig,
  type AlertState,
} from "./schema";

/**
 * Substitute environment variables in a string.
 * Supports ${VAR_NAME} syntax.
 */
function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(`Warning: Environment variable ${varName} is not set`);
      return match; // Keep original if not set
    }
    return envValue;
  });
}

/**
 * Recursively substitute environment variables in an object.
 */
function substituteEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return substituteEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvVarsInObject(item)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsInObject(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Load and validate configuration from a JSON file.
 */
export async function loadConfig(configPath: string): Promise<LunchMonitorConfig> {
  const content = await readFile(configPath, "utf-8");
  const rawConfig = JSON.parse(content);

  // Substitute environment variables
  const configWithEnv = substituteEnvVarsInObject(rawConfig);

  // Validate against schema
  const result = LunchMonitorConfigSchema.safeParse(configWithEnv);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data;
}

/**
 * Save configuration to a JSON file.
 */
export async function saveConfig(
  config: LunchMonitorConfig,
  configPath: string
): Promise<void> {
  // Ensure directory exists
  await mkdir(dirname(configPath), { recursive: true });

  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content, "utf-8");
}

/**
 * Validate configuration without loading from file.
 */
export function validateConfig(config: unknown): {
  valid: boolean;
  config?: LunchMonitorConfig;
  errors?: string[];
} {
  const result = LunchMonitorConfigSchema.safeParse(config);

  if (result.success) {
    return { valid: true, config: result.data };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { valid: false, errors };
}

/**
 * Load alert state from file, or create empty state if file doesn't exist.
 */
export async function loadAlertState(statePath: string): Promise<AlertState> {
  try {
    const content = await readFile(statePath, "utf-8");
    const rawState = JSON.parse(content);
    const result = AlertStateSchema.safeParse(rawState);

    if (result.success) {
      return result.data;
    }

    console.warn("Invalid state file, creating new state");
    return createEmptyAlertState();
  } catch (error) {
    // File doesn't exist or is unreadable, return empty state
    return createEmptyAlertState();
  }
}

/**
 * Save alert state to file.
 */
export async function saveAlertState(
  state: AlertState,
  statePath: string
): Promise<void> {
  // Ensure directory exists
  await mkdir(dirname(statePath), { recursive: true });

  const content = JSON.stringify(state, null, 2);
  await writeFile(statePath, content, "utf-8");
}

/**
 * Get default config path based on platform.
 */
export function getDefaultConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  return `${home}/.config/lunchmonitor/config.json`;
}

/**
 * Get default state path based on platform.
 */
export function getDefaultStatePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  return `${home}/.config/lunchmonitor/state.json`;
}
