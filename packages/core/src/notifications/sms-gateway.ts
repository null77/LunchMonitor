import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailConfig, SmsGatewayConfig } from "../config/schema";
import { SMS_GATEWAY_DOMAINS } from "../config/schema";
import type { AlertNotification } from "../alerts/types";
import type { SendResult, NotificationSender } from "./types";
import { formatSmsNotification } from "./templates";

/**
 * SMS notification sender via email-to-SMS gateways.
 * Uses the same SMTP transport as email, but sends to carrier gateway addresses.
 */
export class SmsGatewaySender implements NotificationSender {
  private transporter: Transporter;
  private smsConfig: SmsGatewayConfig;
  private emailConfig: EmailConfig;
  private currency: string;

  constructor(
    smsConfig: SmsGatewayConfig,
    emailConfig: EmailConfig,
    currency: string = "USD"
  ) {
    this.smsConfig = smsConfig;
    this.emailConfig = emailConfig;
    this.currency = currency;

    // Reuse SMTP config from email
    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: {
        user: emailConfig.smtp.auth.user,
        pass: emailConfig.smtp.auth.pass,
      },
    });
  }

  /**
   * Get the email address for the SMS gateway.
   */
  private getGatewayAddress(): string {
    const domain =
      this.smsConfig.gateway === "custom"
        ? this.smsConfig.customDomain
        : SMS_GATEWAY_DOMAINS[this.smsConfig.gateway];

    if (!domain) {
      throw new Error(`No domain configured for gateway: ${this.smsConfig.gateway}`);
    }

    return `${this.smsConfig.phoneNumber}@${domain}`;
  }

  /**
   * Send a single SMS notification.
   */
  async send(notification: AlertNotification): Promise<SendResult[]> {
    const message = formatSmsNotification(notification, this.currency);
    const recipient = this.getGatewayAddress();

    try {
      const info = await this.transporter.sendMail({
        from: this.emailConfig.from,
        to: recipient,
        subject: "", // SMS gateways typically ignore subject
        text: message,
      });

      return [
        {
          success: true,
          channel: "sms",
          recipient,
          messageId: info.messageId,
        },
      ];
    } catch (error) {
      return [
        {
          success: false,
          channel: "sms",
          recipient,
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }

  /**
   * Send multiple SMS notifications (one per alert).
   */
  async sendAll(notifications: AlertNotification[]): Promise<SendResult[]> {
    const results: SendResult[] = [];

    for (const notification of notifications) {
      const result = await this.send(notification);
      results.push(...result);
    }

    return results;
  }

  /**
   * Send a test SMS.
   */
  async sendTest(): Promise<SendResult[]> {
    const testNotification: AlertNotification = {
      policyId: "test",
      policyName: "Test Policy",
      categoryId: 0,
      categoryName: "Test",
      budgetAmount: 50000,
      spentAmount: 42500,
      percentUsed: 85,
      remaining: 7500,
      highestThreshold: 80,
      message: "Test",
      channels: ["sms"],
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
