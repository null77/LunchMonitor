import type {
  LunchMonitorConfig,
  AlertPolicy,
  ThresholdConfig,
  AlertState,
  TriggeredAlertState,
} from "../config/schema";
import type { Budget } from "../api/types";
import { calculateBudgetUtilization, withoutRedundantGroups } from "../api/lunchmoney";
import type {
  CheckResult,
  TriggeredAlert,
  TriggeredThreshold,
  AlertNotification,
} from "./types";

/**
 * Check if a budget matches the policy scope.
 */
function matchesPolicyScope(budget: Budget, policy: AlertPolicy): boolean {
  const { scope } = policy;

  // Skip income categories
  if (budget.is_income) return false;

  // Skip excluded from budget
  if (budget.exclude_from_budget) return false;

  // Skip archived
  if (budget.archived) return false;

  switch (scope.type) {
    case "global":
      // Check if explicitly excluded
      if (scope.excludeCategories?.includes(budget.category_id)) {
        return false;
      }
      return true;

    case "category":
      return scope.categoryIds?.includes(budget.category_id) ?? false;

    case "category_group":
      return scope.groupIds?.includes(budget.group_id ?? -1) ?? false;

    default:
      return false;
  }
}

/**
 * Evaluate thresholds against a budget's utilization.
 */
function evaluateThresholds(
  utilization: { percentUsed: number; spentAmount: number },
  thresholds: ThresholdConfig[]
): TriggeredThreshold[] {
  const triggered: TriggeredThreshold[] = [];

  for (const threshold of thresholds) {
    const targetValue =
      threshold.type === "percentage"
        ? utilization.percentUsed
        : utilization.spentAmount;

    let thresholdMet = false;
    switch (threshold.operator) {
      case "gte":
        thresholdMet = targetValue >= threshold.value;
        break;
      case "gt":
        thresholdMet = targetValue > threshold.value;
        break;
      case "eq":
        thresholdMet = Math.abs(targetValue - threshold.value) < 0.01;
        break;
    }

    if (thresholdMet) {
      triggered.push({
        threshold,
        actualValue: targetValue,
        percentUsed: utilization.percentUsed,
      });
    }
  }

  return triggered;
}

/**
 * Check if an alert should be skipped due to cooldown.
 */
function shouldSkipDueToCooldown(
  alert: TriggeredAlert,
  state: AlertState
): boolean {
  const cooldown = alert.policy.cooldown;
  if (!cooldown) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find previous alerts for this policy and category
  const previousAlerts = state.triggeredAlerts.filter(
    (a) =>
      a.policyId === alert.policy.id && a.categoryId === alert.categoryId
  );

  if (previousAlerts.length === 0) return false;

  switch (cooldown.type) {
    case "once_per_threshold": {
      // Skip if we already alerted for this threshold value
      const highestTriggered = Math.max(
        ...alert.thresholds.map((t) => t.threshold.value)
      );
      return previousAlerts.some((a) => a.thresholdValue >= highestTriggered);
    }

    case "once_per_day": {
      // Skip if we already alerted today
      return previousAlerts.some((a) => {
        const alertDate = new Date(a.triggeredAt);
        return alertDate >= todayStart;
      });
    }

    case "every_check":
      // Never skip
      return false;

    default:
      return false;
  }
}

/**
 * Check if current time is within quiet hours.
 */
function isQuietHours(config: LunchMonitorConfig): boolean {
  const quietHours = config.settings.quietHours;
  if (!quietHours) return false;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const currentTime = formatter.format(now);
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHours.start.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;

  const [endHour, endMinute] = quietHours.end.split(":").map(Number);
  const endMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Evaluate all budgets against all enabled policies.
 */
export function evaluateBudgets(
  budgets: Budget[],
  config: LunchMonitorConfig,
  state: AlertState
): CheckResult {
  const triggeredAlerts: TriggeredAlert[] = [];
  const skippedDueToCooldown: TriggeredAlert[] = [];
  const enabledPolicies = config.policies.filter((p) => p.enabled);

  // A group's budget is the sum of its children's. Under a global policy, alert
  // on the budgeted children and skip their group so the same money isn't
  // reported twice; a group is still checked if none of its children has a budget.
  const budgeted = budgets.filter((b) => calculateBudgetUtilization(b).budgetAmount !== 0);
  const globalBudgets = withoutRedundantGroups(budgeted);

  for (const policy of enabledPolicies) {
    const candidates = policy.scope.type === "global" ? globalBudgets : budgets;
    for (const budget of candidates) {
      if (!matchesPolicyScope(budget, policy)) continue;

      const utilization = calculateBudgetUtilization(budget);

      // Skip if no budget set
      if (utilization.budgetAmount === 0) continue;

      const thresholds = evaluateThresholds(utilization, policy.thresholds);

      if (thresholds.length > 0) {
        const alert: TriggeredAlert = {
          policy,
          budget,
          categoryId: budget.category_id,
          categoryName: budget.category_name,
          budgetAmount: utilization.budgetAmount,
          spentAmount: utilization.spentAmount,
          percentUsed: utilization.percentUsed,
          remaining: utilization.remaining,
          thresholds,
        };

        if (shouldSkipDueToCooldown(alert, state)) {
          skippedDueToCooldown.push(alert);
        } else {
          triggeredAlerts.push(alert);
        }
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    budgetsChecked: budgets.length,
    policiesEvaluated: enabledPolicies.length,
    triggeredAlerts,
    skippedDueToCooldown,
  };
}

/**
 * Convert triggered alerts to notification format.
 */
export function alertsToNotifications(
  alerts: TriggeredAlert[]
): AlertNotification[] {
  return alerts.map((alert) => {
    const highestThreshold = alert.thresholds.reduce(
      (max, t) => Math.max(max, t.threshold.value),
      0
    );

    const messageThreshold = alert.thresholds.find(
      (t) => t.threshold.value === highestThreshold
    );

    const defaultMessage =
      alert.percentUsed >= 100
        ? `Budget exceeded! ${alert.categoryName} is at ${alert.percentUsed.toFixed(0)}%`
        : `Budget warning: ${alert.categoryName} is at ${alert.percentUsed.toFixed(0)}%`;

    return {
      policyId: alert.policy.id,
      policyName: alert.policy.name,
      categoryId: alert.categoryId,
      categoryName: alert.categoryName,
      budgetAmount: alert.budgetAmount,
      spentAmount: alert.spentAmount,
      percentUsed: alert.percentUsed,
      remaining: alert.remaining,
      highestThreshold,
      message: messageThreshold?.threshold.message ?? defaultMessage,
      channels: alert.policy.channels,
    };
  });
}

/**
 * Update alert state with newly triggered alerts.
 */
export function updateAlertState(
  state: AlertState,
  alerts: TriggeredAlert[]
): AlertState {
  const now = new Date().toISOString();

  const newTriggered: TriggeredAlertState[] = alerts.map((alert) => ({
    policyId: alert.policy.id,
    categoryId: alert.categoryId,
    thresholdValue: Math.max(...alert.thresholds.map((t) => t.threshold.value)),
    triggeredAt: now,
  }));

  // Keep alerts from the current month, add new ones
  const currentMonth = now.substring(0, 7); // "YYYY-MM"
  const existingAlerts = state.triggeredAlerts.filter(
    (a) => a.triggeredAt.substring(0, 7) === currentMonth
  );

  return {
    lastChecked: now,
    triggeredAlerts: [...existingAlerts, ...newTriggered],
  };
}

/**
 * Check if notifications should be sent (respecting quiet hours).
 */
export function shouldSendNotifications(config: LunchMonitorConfig): boolean {
  return !isQuietHours(config);
}
