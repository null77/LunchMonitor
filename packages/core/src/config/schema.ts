import { z } from "zod";

// SMS Gateway types
export const SmsGatewaySchema = z.enum([
  "verizon",
  "att",
  "tmobile",
  "sprint",
  "custom",
]);

export type SmsGateway = z.infer<typeof SmsGatewaySchema>;

// SMS gateway domain mapping
export const SMS_GATEWAY_DOMAINS: Record<SmsGateway, string> = {
  verizon: "vtext.com",
  att: "txt.att.net",
  tmobile: "tmomail.net",
  sprint: "messaging.sprintpcs.com",
  custom: "",
};

// Email configuration
export const EmailConfigSchema = z.object({
  enabled: z.boolean(),
  smtp: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean().default(false),
    auth: z.object({
      user: z.string(),
      pass: z.string(), // Supports ${ENV_VAR} syntax
    }),
  }),
  from: z.string().email().or(z.string().regex(/^.+<.+@.+>$/)), // "Name <email>" format
  to: z.array(z.string().email()).min(1),
});

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

// SMS gateway configuration
export const SmsGatewayConfigSchema = z.object({
  enabled: z.boolean(),
  gateway: SmsGatewaySchema,
  customDomain: z.string().optional(),
  phoneNumber: z.string().regex(/^\d{10,11}$/, "Phone number must be 10-11 digits"),
});

export type SmsGatewayConfig = z.infer<typeof SmsGatewayConfigSchema>;

// Threshold configuration
export const ThresholdConfigSchema = z.object({
  type: z.enum(["percentage", "absolute"]),
  operator: z.enum(["gte", "gt", "eq"]).default("gte"),
  value: z.number().positive(),
  message: z.string().optional(),
});

export type ThresholdConfig = z.infer<typeof ThresholdConfigSchema>;

// Alert policy scope
export const PolicyScopeSchema = z.object({
  type: z.enum(["global", "category", "category_group"]),
  categoryIds: z.array(z.number()).optional(),
  groupIds: z.array(z.number()).optional(),
  excludeCategories: z.array(z.number()).optional(),
});

export type PolicyScope = z.infer<typeof PolicyScopeSchema>;

// Cooldown configuration
export const CooldownConfigSchema = z.object({
  type: z.enum(["once_per_threshold", "once_per_day", "every_check"]),
});

export type CooldownConfig = z.infer<typeof CooldownConfigSchema>;

// Alert policy
export const AlertPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  scope: PolicyScopeSchema,
  thresholds: z.array(ThresholdConfigSchema).min(1),
  channels: z.array(z.enum(["email", "sms"])).min(1),
  cooldown: CooldownConfigSchema.optional(),
});

export type AlertPolicy = z.infer<typeof AlertPolicySchema>;

// Quiet hours configuration
export const QuietHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be in HH:MM format"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be in HH:MM format"),
});

export type QuietHours = z.infer<typeof QuietHoursSchema>;

// Global settings
export const SettingsSchema = z.object({
  checkIntervalMinutes: z.number().int().positive().default(360), // 6 hours
  timezone: z.string().default("America/New_York"),
  currency: z.string().optional(),
  quietHours: QuietHoursSchema.optional(),
});

export type Settings = z.infer<typeof SettingsSchema>;

// LunchMoney API configuration
export const LunchMoneyConfigSchema = z.object({
  apiToken: z.string().min(1), // Supports ${ENV_VAR} syntax
  baseUrl: z.string().url().optional(),
});

export type LunchMoneyConfig = z.infer<typeof LunchMoneyConfigSchema>;

// Notifications configuration
export const NotificationsConfigSchema = z.object({
  email: EmailConfigSchema.optional(),
  sms: SmsGatewayConfigSchema.optional(),
});

export type NotificationsConfig = z.infer<typeof NotificationsConfigSchema>;

// Full configuration schema
export const LunchMonitorConfigSchema = z.object({
  version: z.literal("1.0"),
  lunchmoney: LunchMoneyConfigSchema,
  notifications: NotificationsConfigSchema,
  policies: z.array(AlertPolicySchema),
  settings: SettingsSchema,
});

export type LunchMonitorConfig = z.infer<typeof LunchMonitorConfigSchema>;

// Alert state schema (for persistence)
export const TriggeredAlertStateSchema = z.object({
  policyId: z.string().uuid(),
  categoryId: z.number(),
  thresholdValue: z.number(),
  triggeredAt: z.string().datetime(),
});

export type TriggeredAlertState = z.infer<typeof TriggeredAlertStateSchema>;

export const AlertStateSchema = z.object({
  lastChecked: z.string().datetime(),
  triggeredAlerts: z.array(TriggeredAlertStateSchema),
});

export type AlertState = z.infer<typeof AlertStateSchema>;

// Default configuration template
export function createDefaultConfig(): LunchMonitorConfig {
  return {
    version: "1.0",
    lunchmoney: {
      apiToken: "${LUNCHMONEY_TOKEN}",
    },
    notifications: {
      email: {
        enabled: true,
        smtp: {
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: "${SMTP_USER}",
            pass: "${SMTP_PASS}",
          },
        },
        from: "LunchMonitor <alerts@example.com>",
        to: ["your-email@example.com"],
      },
    },
    policies: [
      {
        id: crypto.randomUUID(),
        name: "Default Budget Alert",
        enabled: true,
        scope: {
          type: "global",
        },
        thresholds: [
          { type: "percentage", operator: "gte", value: 80, message: "Warning: Budget at 80%" },
          { type: "percentage", operator: "gte", value: 100, message: "Critical: Budget exceeded!" },
        ],
        channels: ["email"],
        cooldown: { type: "once_per_threshold" },
      },
    ],
    settings: {
      checkIntervalMinutes: 360,
      timezone: "America/New_York",
    },
  };
}

// Create empty alert state
export function createEmptyAlertState(): AlertState {
  return {
    lastChecked: new Date().toISOString(),
    triggeredAlerts: [],
  };
}
