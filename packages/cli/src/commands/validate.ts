import { readFile } from "node:fs/promises";
import { validateConfig, getDefaultConfigPath } from "@lunchmonitor/core";

export interface ValidateOptions {
  configPath?: string;
}

export async function validate(options: ValidateOptions): Promise<number> {
  const configPath = options.configPath ?? getDefaultConfigPath();

  try {
    console.log(`Validating config: ${configPath}`);

    const content = await readFile(configPath, "utf-8");
    let rawConfig: unknown;

    try {
      rawConfig = JSON.parse(content);
    } catch {
      console.error("Error: Invalid JSON syntax");
      return 1;
    }

    const result = validateConfig(rawConfig);

    if (result.valid) {
      console.log("✓ Configuration is valid");

      // Print summary
      const config = result.config!;
      console.log(`\nSummary:`);
      console.log(`  Version: ${config.version}`);
      console.log(`  Policies: ${config.policies.length}`);
      console.log(`  Email: ${config.notifications.email?.enabled ? "enabled" : "disabled"}`);
      console.log(`  SMS: ${config.notifications.sms?.enabled ? "enabled" : "disabled"}`);
      console.log(`  Timezone: ${config.settings.timezone}`);

      if (config.policies.length > 0) {
        console.log(`\nAlert Policies:`);
        for (const policy of config.policies) {
          const status = policy.enabled ? "✓" : "○";
          const thresholds = policy.thresholds
            .map((t) => `${t.value}${t.type === "percentage" ? "%" : ""}`)
            .join(", ");
          console.log(`  ${status} ${policy.name} (${policy.scope.type}, thresholds: ${thresholds})`);
        }
      }

      return 0;
    } else {
      console.error("✗ Configuration is invalid:\n");
      for (const error of result.errors ?? []) {
        console.error(`  - ${error}`);
      }
      return 1;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: Config file not found: ${configPath}`);
    } else {
      console.error("Error:", error instanceof Error ? error.message : error);
    }
    return 1;
  }
}
