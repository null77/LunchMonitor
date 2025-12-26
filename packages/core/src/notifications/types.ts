import type { AlertNotification } from "../alerts/types";

/**
 * Result of sending a notification.
 */
export interface SendResult {
  success: boolean;
  channel: "email" | "sms";
  recipient: string;
  error?: string;
  messageId?: string;
}

/**
 * Aggregated result of sending all notifications.
 */
export interface NotificationResult {
  sent: number;
  failed: number;
  results: SendResult[];
}

/**
 * Formatted notification content.
 */
export interface FormattedNotification {
  subject: string;
  textBody: string;
  htmlBody: string;
}

/**
 * Interface for notification senders.
 */
export interface NotificationSender {
  send(notification: AlertNotification): Promise<SendResult[]>;
}
