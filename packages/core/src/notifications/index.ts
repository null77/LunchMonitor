import type { LunchMonitorConfig } from "../config/schema";
import type { AlertNotification } from "../alerts/types";
import type { NotificationResult, SendResult } from "./types";
import { EmailSender } from "./email";
import { SmsGatewaySender } from "./sms-gateway";

export { EmailSender } from "./email";
export { SmsGatewaySender } from "./sms-gateway";
export * from "./types";
export * from "./templates";

/**
 * Notification dispatcher that routes alerts to configured channels.
 */
export class NotificationDispatcher {
  private emailSender?: EmailSender;
  private smsSender?: SmsGatewaySender;
  private currency: string;

  constructor(config: LunchMonitorConfig) {
    this.currency = config.settings.currency ?? "USD";

    // Initialize email sender if configured
    if (config.notifications.email?.enabled) {
      this.emailSender = new EmailSender(
        config.notifications.email,
        this.currency
      );
    }

    // Initialize SMS sender if configured (requires email for SMTP)
    if (
      config.notifications.sms?.enabled &&
      config.notifications.email
    ) {
      this.smsSender = new SmsGatewaySender(
        config.notifications.sms,
        config.notifications.email,
        this.currency
      );
    }
  }

  /**
   * Send notifications for all alerts.
   * Groups email notifications into a summary, sends SMS individually.
   */
  async sendAll(notifications: AlertNotification[]): Promise<NotificationResult> {
    const results: SendResult[] = [];

    // Group notifications by channel
    const emailNotifications = notifications.filter((n) =>
      n.channels.includes("email")
    );
    const smsNotifications = notifications.filter((n) =>
      n.channels.includes("sms")
    );

    // Send email summary
    if (this.emailSender && emailNotifications.length > 0) {
      const emailResults = await this.emailSender.sendSummary(emailNotifications);
      results.push(...emailResults);
    }

    // Send individual SMS
    if (this.smsSender && smsNotifications.length > 0) {
      const smsResults = await this.smsSender.sendAll(smsNotifications);
      results.push(...smsResults);
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { sent, failed, results };
  }

  /**
   * Send a single notification to specified channels.
   */
  async send(
    notification: AlertNotification,
    channels?: ("email" | "sms")[]
  ): Promise<NotificationResult> {
    const activeChannels = channels ?? notification.channels;
    const results: SendResult[] = [];

    if (activeChannels.includes("email") && this.emailSender) {
      const emailResults = await this.emailSender.send(notification);
      results.push(...emailResults);
    }

    if (activeChannels.includes("sms") && this.smsSender) {
      const smsResults = await this.smsSender.send(notification);
      results.push(...smsResults);
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { sent, failed, results };
  }

  /**
   * Send test notifications to verify configuration.
   */
  async sendTest(channel: "email" | "sms"): Promise<NotificationResult> {
    const results: SendResult[] = [];

    if (channel === "email" && this.emailSender) {
      const emailResults = await this.emailSender.sendTest();
      results.push(...emailResults);
    }

    if (channel === "sms" && this.smsSender) {
      const smsResults = await this.smsSender.sendTest();
      results.push(...smsResults);
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { sent, failed, results };
  }

  /**
   * Verify all configured channels.
   */
  async verify(): Promise<{ email?: boolean; sms?: boolean }> {
    const result: { email?: boolean; sms?: boolean } = {};

    if (this.emailSender) {
      result.email = await this.emailSender.verify();
    }

    // SMS uses same SMTP, so verification is the same
    if (this.smsSender && this.emailSender) {
      result.sms = await this.emailSender.verify();
    }

    return result;
  }

  /**
   * Close all transport connections.
   */
  close(): void {
    this.emailSender?.close();
    this.smsSender?.close();
  }
}
