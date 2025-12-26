#!/usr/bin/env bun

import { check } from "./commands/check";
import { validate } from "./commands/validate";
import { testNotify } from "./commands/test-notify";
import { status } from "./commands/status";
import { init } from "./commands/init";

const VERSION = "1.0.0";

function printHelp(): void {
  console.log(`
LunchMonitor v${VERSION}
Budget monitoring for LunchMoney

USAGE:
  lunchmonitor <command> [options]

COMMANDS:
  check        Check budgets and send notifications if thresholds exceeded
  status       Show current budget status (no notifications)
  validate     Validate configuration file
  test-notify  Send a test notification
  init         Create a default configuration file

OPTIONS:
  --config, -c <path>    Path to config file (default: ~/.config/lunchmonitor/config.json)
  --dry-run              Check budgets without sending notifications
  --verbose, -v          Show detailed output
  --channel <email|sms>  Notification channel for test-notify
  --all                  Show all categories including those without budgets
  --force                Overwrite existing config (for init)
  --help, -h             Show this help message
  --version              Show version

EXAMPLES:
  lunchmonitor init                      Create default config
  lunchmonitor check -c ./config.json    Check budgets with custom config
  lunchmonitor status                    View current budget status
  lunchmonitor test-notify --channel sms Test SMS notification
`.trim());
}

function parseArgs(args: string[]): {
  command?: string;
  options: Record<string, string | boolean>;
} {
  const options: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Handle flags that take values
      if (["config", "channel"].includes(key) && nextArg && !nextArg.startsWith("-")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);

      // Handle short flags
      switch (key) {
        case "c":
          if (args[i + 1] && !args[i + 1].startsWith("-")) {
            options["config"] = args[i + 1];
            i++;
          }
          break;
        case "v":
          options["verbose"] = true;
          break;
        case "h":
          options["help"] = true;
          break;
        default:
          options[key] = true;
      }
    } else if (!command) {
      command = arg;
    }
  }

  return { command, options };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  // Handle help
  if (options.help || !command) {
    printHelp();
    return 0;
  }

  // Handle version
  if (options.version) {
    console.log(`LunchMonitor v${VERSION}`);
    return 0;
  }

  // Extract common options
  const configPath = options.config as string | undefined;
  const verbose = !!options.verbose;

  // Route to command
  switch (command) {
    case "check":
      return check({
        configPath,
        dryRun: !!options["dry-run"],
        verbose,
      });

    case "status":
      return status({
        configPath,
        showAll: !!options.all,
      });

    case "validate":
      return validate({ configPath });

    case "test-notify":
      return testNotify({
        configPath,
        channel: options.channel as "email" | "sms" | undefined,
      });

    case "init":
      return init({
        configPath,
        force: !!options.force,
      });

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'lunchmonitor --help' for usage");
      return 1;
  }
}

// Run
main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
