import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailConfig } from "../config/schema";
import type { AlertNotification } from "../alerts/types";
import type { SendResult, NotificationSender } from "./types";
import { formatEmailNotification, formatSummaryEmail } from "./templates";

/**
 * Email notification sender using SMTP.
 */
export class EmailSender implements NotificationSender {
  private transporter: Transporter;
  private config: EmailConfig;
  private currency: string;

  constructor(config: EmailConfig, currency: string = "USD") {
    this.config = config;
    this.currency = currency;
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.auth.user,
        pass: config.smtp.auth.pass,
      },
    });
  }

  /**
   * Verify SMTP connection.
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send a single notification email.
   */
  async send(notification: AlertNotification): Promise<SendResult[]> {
    const formatted = formatEmailNotification(notification, this.currency);
    const results: SendResult[] = [];

    for (const recipient of this.config.to) {
      try {
        const info = await this.transporter.sendMail({
          from: this.config.from,
          to: recipient,
          subject: formatted.subject,
          text: formatted.textBody,
          html: formatted.htmlBody,
        });

        results.push({
          success: true,
          channel: "email",
          recipient,
          messageId: info.messageId,
        });
      } catch (error) {
        results.push({
          success: false,
          channel: "email",
          recipient,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Send a summary email with multiple notifications.
   */
  async sendSummary(notifications: AlertNotification[]): Promise<SendResult[]> {
    if (notifications.length === 0) return [];

    const formatted = formatSummaryEmail(notifications, this.currency);
    const results: SendResult[] = [];

    for (const recipient of this.config.to) {
      try {
        const info = await this.transporter.sendMail({
          from: this.config.from,
          to: recipient,
          subject: formatted.subject,
          text: formatted.textBody,
          html: formatted.htmlBody,
        });

        results.push({
          success: true,
          channel: "email",
          recipient,
          messageId: info.messageId,
        });
      } catch (error) {
        results.push({
          success: false,
          channel: "email",
          recipient,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Send a test email.
   */
  async sendTest(): Promise<SendResult[]> {
    const testNotification: AlertNotification = {
      policyId: "test",
      policyName: "Test Policy",
      categoryId: 0,
      categoryName: "Test Category",
      budgetAmount: 50000, // $500
      spentAmount: 42500, // $425
      percentUsed: 85,
      remaining: 7500, // $75
      highestThreshold: 80,
      message: "This is a test notification from LunchMonitor",
      channels: ["email"],
    };

    return this.send(testNotification);
  }

  /**
   * Close the transport connection.
   */
  close(): void {
    this.transporter.close();
  }
}
