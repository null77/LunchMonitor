import {
  loadConfig,
  getDefaultConfigPath,
  NotificationDispatcher,
} from "@lunchmonitor/core";

export interface TestNotifyOptions {
  configPath?: string;
  channel?: "email" | "sms";
}

export async function testNotify(options: TestNotifyOptions): Promise<number> {
  const configPath = options.configPath ?? getDefaultConfigPath();
  const channel = options.channel ?? "email";

  try {
    console.log(`Loading config from: ${configPath}`);
    const config = await loadConfig(configPath);

    // Check if channel is configured
    if (channel === "email" && !config.notifications.email?.enabled) {
      console.error("Error: Email notifications are not enabled in config");
      return 1;
    }

    if (channel === "sms" && !config.notifications.sms?.enabled) {
      console.error("Error: SMS notifications are not enabled in config");
      return 1;
    }

    console.log(`Sending test ${channel} notification...`);
    const dispatcher = new NotificationDispatcher(config);

    try {
      // Verify connection first
      const verification = await dispatcher.verify();
      if (channel === "email" && !verification.email) {
        console.error("Error: Failed to connect to SMTP server");
        return 1;
      }

      // Send test
      const result = await dispatcher.sendTest(channel);

      if (result.sent > 0) {
        console.log(`✓ Test ${channel} sent successfully`);
        for (const r of result.results.filter((r) => r.success)) {
          console.log(`  Sent to: ${r.recipient}`);
        }
        return 0;
      } else {
        console.error(`✗ Failed to send test ${channel}`);
        for (const r of result.results.filter((r) => !r.success)) {
          console.error(`  ${r.recipient}: ${r.error}`);
        }
        return 1;
      }
    } finally {
      dispatcher.close();
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    return 1;
  }
}
