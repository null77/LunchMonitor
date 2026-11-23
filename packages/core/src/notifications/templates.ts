import type { AlertNotification } from "../alerts/types";
import type { FormattedNotification } from "./types";

/**
 * Format currency value.
 */
function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount); // LunchMoney amounts are in major units (dollars), not cents
}

/**
 * Format a single notification for email.
 */
export function formatEmailNotification(
  notification: AlertNotification,
  currency: string = "USD"
): FormattedNotification {
  const {
    categoryName,
    budgetAmount,
    spentAmount,
    percentUsed,
    remaining,
    message,
  } = notification;

  const subject =
    percentUsed >= 100
      ? `🚨 Budget Exceeded: ${categoryName}`
      : `⚠️ Budget Alert: ${categoryName}`;

  const textBody = `
${message}

Category: ${categoryName}
Budget: ${formatCurrency(budgetAmount, currency)}
Spent: ${formatCurrency(spentAmount, currency)}
Remaining: ${formatCurrency(remaining, currency)}
Utilization: ${percentUsed.toFixed(1)}%

---
Sent by LunchMonitor
`.trim();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 500px; margin: 0 auto; padding: 20px; }
    .alert { padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .alert-warning { background-color: #fff3cd; border-left: 4px solid #ffc107; }
    .alert-danger { background-color: #f8d7da; border-left: 4px solid #dc3545; }
    .stats { background-color: #f8f9fa; padding: 16px; border-radius: 8px; }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: #6c757d; }
    .stat-value { font-weight: 600; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
    .progress { height: 8px; background-color: #e9ecef; border-radius: 4px; overflow: hidden; margin: 8px 0; }
    .progress-bar { height: 100%; transition: width 0.3s; }
    .progress-warning { background-color: #ffc107; }
    .progress-danger { background-color: #dc3545; }
  </style>
</head>
<body>
  <div class="alert ${percentUsed >= 100 ? "alert-danger" : "alert-warning"}">
    <strong>${message}</strong>
  </div>

  <div class="stats">
    <div class="stat-row">
      <span class="stat-label">Category</span>
      <span class="stat-value">${categoryName}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Budget</span>
      <span class="stat-value">${formatCurrency(budgetAmount, currency)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Spent</span>
      <span class="stat-value">${formatCurrency(spentAmount, currency)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Remaining</span>
      <span class="stat-value">${formatCurrency(remaining, currency)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Utilization</span>
      <span class="stat-value">${percentUsed.toFixed(1)}%</span>
    </div>
    <div class="progress">
      <div class="progress-bar ${percentUsed >= 100 ? "progress-danger" : "progress-warning"}"
           style="width: ${Math.min(percentUsed, 100)}%"></div>
    </div>
  </div>

  <div class="footer">
    Sent by LunchMonitor
  </div>
</body>
</html>
`.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Format a single notification for SMS (short format).
 */
export function formatSmsNotification(
  notification: AlertNotification,
  currency: string = "USD"
): string {
  const { categoryName, spentAmount, budgetAmount, percentUsed } = notification;

  // Keep under 160 chars for SMS
  const emoji = percentUsed >= 100 ? "🚨" : "⚠️";
  const spent = formatCurrency(spentAmount, currency);
  const budget = formatCurrency(budgetAmount, currency);

  return `${emoji} ${categoryName}: ${percentUsed.toFixed(0)}% (${spent}/${budget})`;
}

/**
 * Format multiple notifications into a summary email.
 */
export function formatSummaryEmail(
  notifications: AlertNotification[],
  currency: string = "USD"
): FormattedNotification {
  const criticalCount = notifications.filter((n) => n.percentUsed >= 100).length;
  const warningCount = notifications.length - criticalCount;

  const subject =
    criticalCount > 0
      ? `🚨 ${criticalCount} Budget(s) Exceeded, ${warningCount} Warning(s)`
      : `⚠️ ${warningCount} Budget Warning(s)`;

  const textLines = notifications.map((n) => {
    const status = n.percentUsed >= 100 ? "EXCEEDED" : "WARNING";
    return `[${status}] ${n.categoryName}: ${n.percentUsed.toFixed(0)}% (${formatCurrency(n.spentAmount, currency)}/${formatCurrency(n.budgetAmount, currency)})`;
  });

  const textBody = `
Budget Alert Summary
====================

${textLines.join("\n")}

---
Sent by LunchMonitor
`.trim();

  const htmlRows = notifications
    .map((n) => {
      const statusClass = n.percentUsed >= 100 ? "danger" : "warning";
      const statusText = n.percentUsed >= 100 ? "EXCEEDED" : "WARNING";
      return `
      <tr>
        <td><span class="badge badge-${statusClass}">${statusText}</span></td>
        <td>${n.categoryName}</td>
        <td>${n.percentUsed.toFixed(0)}%</td>
        <td>${formatCurrency(n.spentAmount, currency)}</td>
        <td>${formatCurrency(n.budgetAmount, currency)}</td>
      </tr>`;
    })
    .join("");

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h2 { margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background-color: #f8f9fa; font-weight: 600; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-warning { background-color: #fff3cd; color: #856404; }
    .badge-danger { background-color: #f8d7da; color: #721c24; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <h2>Budget Alert Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Category</th>
        <th>Used</th>
        <th>Spent</th>
        <th>Budget</th>
      </tr>
    </thead>
    <tbody>
      ${htmlRows}
    </tbody>
  </table>
  <div class="footer">Sent by LunchMonitor</div>
</body>
</html>
`.trim();

  return { subject, textBody, htmlBody };
}
