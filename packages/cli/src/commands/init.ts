import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createDefaultConfig,
  getDefaultConfigPath,
} from "@lunchmonitor/core";

export interface InitOptions {
  configPath?: string;
  force?: boolean;
}

export async function init(options: InitOptions): Promise<number> {
  const configPath = resolve(options.configPath ?? getDefaultConfigPath());
  const { force = false } = options;

  try {
    // Check if config already exists
    try {
      await access(configPath);
      if (!force) {
        console.error(`Config already exists at: ${configPath}`);
        console.error("Use --force to overwrite");
        return 1;
      }
    } catch {
      // File doesn't exist, good to proceed
    }

    // Create directory if parent exists
    const dir = dirname(configPath);
    if (dir && dir !== ".") {
      await mkdir(dir, { recursive: true });
    }

    // Create default config
    const config = createDefaultConfig();
    const content = JSON.stringify(config, null, 2);

    await writeFile(configPath, content, "utf-8");

    console.log(`✓ Created config at: ${configPath}`);
    console.log("\nNext steps:");
    console.log("1. Edit the config file with your settings:");
    console.log(`   - Add your LunchMoney API token`);
    console.log(`   - Configure email/SMS notifications`);
    console.log(`   - Customize alert policies`);
    console.log("\n2. Set environment variables:");
    console.log("   export LUNCHMONEY_TOKEN='your_token'");
    console.log("   export SMTP_USER='your_email'");
    console.log("   export SMTP_PASS='your_password'");
    console.log("\n3. Validate your config:");
    console.log(`   lunchmonitor validate --config ${configPath}`);
    console.log("\n4. Test notifications:");
    console.log(`   lunchmonitor test-notify --config ${configPath}`);
    console.log("\n5. Check your budgets:");
    console.log(`   lunchmonitor status --config ${configPath}`);

    return 0;
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    return 1;
  }
}
