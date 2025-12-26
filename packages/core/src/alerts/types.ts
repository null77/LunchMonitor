import type { AlertPolicy, ThresholdConfig } from "../config/schema";
import type { Budget } from "../api/types";

/**
 * Result of a single threshold evaluation.
 */
export interface TriggeredThreshold {
  threshold: ThresholdConfig;
  actualValue: number;
  percentUsed: number;
}

/**
 * A triggered alert for a specific category and policy.
 */
export interface TriggeredAlert {
  policy: AlertPolicy;
  budget: Budget;
  categoryId: number;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentUsed: number;
  remaining: number;
  thresholds: TriggeredThreshold[];
}

/**
 * Result of checking all budgets against all policies.
 */
export interface CheckResult {
  checkedAt: string;
  budgetsChecked: number;
  policiesEvaluated: number;
  triggeredAlerts: TriggeredAlert[];
  skippedDueToCooldown: TriggeredAlert[];
}

/**
 * Alert ready to be sent via notification.
 */
export interface AlertNotification {
  policyId: string;
  policyName: string;
  categoryId: number;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentUsed: number;
  remaining: number;
  highestThreshold: number;
  message: string;
  channels: ("email" | "sms")[];
}
