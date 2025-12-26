import {
  loadConfig,
  loadAlertState,
  saveAlertState,
  getDefaultConfigPath,
  getDefaultStatePath,
  LunchMoneyClient,
  evaluateBudgets,
  alertsToNotifications,
  updateAlertState,
  shouldSendNotifications,
  NotificationDispatcher,
} from "@lunchmonitor/core";

export interface CheckOptions {
  configPath?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export async function check(options: CheckOptions): Promise<number> {
  const configPath = options.configPath ?? getDefaultConfigPath();
  const statePath = getDefaultStatePath();
  const { dryRun = false, verbose = false } = options;

  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  try {
    // Load configuration
    log(`Loading config from: ${configPath}`);
    const config = await loadConfig(configPath);

    // Load alert state
    log(`Loading state from: ${statePath}`);
    const state = await loadAlertState(statePath);

    // Create API client
    const client = new LunchMoneyClient(config.lunchmoney);

    // Fetch budgets
    log("Fetching budgets from LunchMoney...");
    const budgets = await client.getCurrentMonthBudgets(config.settings.timezone);
    log(`Found ${budgets.length} budget categories`);

    // Evaluate alerts
    log("Evaluating alert policies...");
    const result = evaluateBudgets(budgets, config, state);

    log(`Checked ${result.budgetsChecked} budgets against ${result.policiesEvaluated} policies`);
    log(`Triggered: ${result.triggeredAlerts.length}, Skipped (cooldown): ${result.skippedDueToCooldown.length}`);

    if (result.triggeredAlerts.length === 0) {
      console.log("No alerts triggered.");
      return 0;
    }

    // Convert to notifications
    const notifications = alertsToNotifications(result.triggeredAlerts);

    // Check quiet hours
    if (!shouldSendNotifications(config)) {
      console.log(`${notifications.length} alert(s) triggered, but in quiet hours. Notifications deferred.`);
      return 0;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would send ${notifications.length} notification(s):`);
      for (const n of notifications) {
        console.log(`  - ${n.categoryName}: ${n.percentUsed.toFixed(0)}% (${n.message})`);
      }
      return 0;
    }

    // Send notifications
    log("Sending notifications...");
    const dispatcher = new NotificationDispatcher(config);

    try {
      const sendResult = await dispatcher.sendAll(notifications);
      console.log(`Sent ${sendResult.sent} notification(s), ${sendResult.failed} failed`);

      if (verbose && sendResult.failed > 0) {
        for (const r of sendResult.results.filter((r) => !r.success)) {
          console.error(`  Failed: ${r.recipient} - ${r.error}`);
        }
      }

      // Update state only after successful send
      const newState = updateAlertState(state, result.triggeredAlerts);
      await saveAlertState(newState, statePath);
      log("State saved.");

      return sendResult.failed > 0 ? 1 : 0;
    } finally {
      dispatcher.close();
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    return 1;
  }
}
