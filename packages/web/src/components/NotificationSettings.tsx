import { useState } from "preact/hooks";
import type { LunchMonitorConfig, EmailConfig, SmsGatewayConfig } from "@lunchmonitor/core";

interface NotificationSettingsProps {
  config: LunchMonitorConfig["notifications"];
  onChange: (updates: Partial<LunchMonitorConfig["notifications"]>) => void;
}

const SMS_GATEWAYS = [
  { value: "verizon", label: "Verizon (@vtext.com)" },
  { value: "att", label: "AT&T (@txt.att.net)" },
  { value: "tmobile", label: "T-Mobile (@tmomail.net)" },
  { value: "sprint", label: "Sprint (@messaging.sprintpcs.com)" },
  { value: "custom", label: "Custom Domain" },
] as const;

function ToAddressInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  // Use local state for the raw input to allow free typing
  const [localValue, setLocalValue] = useState(value.join(", "));

  // Sync local state when external value changes (e.g., loading config)
  const externalValue = value.join(", ");
  if (localValue !== externalValue && !document.activeElement?.matches('input[data-to-input]')) {
    setLocalValue(externalValue);
  }

  return (
    <div>
      <label class="label">To Addresses (comma-separated)</label>
      <input
        type="text"
        class="input"
        data-to-input
        placeholder="you@example.com, partner@example.com"
        value={localValue}
        onInput={(e) => {
          const newValue = (e.target as HTMLInputElement).value;
          setLocalValue(newValue);
          // Parse and update parent, but don't filter empty - let blur handle cleanup
          const addresses = newValue.split(",").map((s) => s.trim()).filter(Boolean);
          onChange(addresses.length > 0 ? addresses : [""]);
        }}
        onBlur={() => {
          // Clean up and normalize on blur
          const addresses = localValue.split(",").map((s) => s.trim()).filter(Boolean);
          const cleaned = addresses.length > 0 ? addresses : [""];
          onChange(cleaned);
          setLocalValue(cleaned.join(", "));
        }}
      />
    </div>
  );
}

export function NotificationSettings({ config, onChange }: NotificationSettingsProps) {
  const updateEmail = (updates: Partial<EmailConfig>) => {
    onChange({
      email: {
        ...config.email,
        enabled: config.email?.enabled ?? false,
        smtp: config.email?.smtp ?? {
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: { user: "", pass: "" },
        },
        from: config.email?.from ?? "",
        to: config.email?.to ?? [""],
        ...updates,
      } as EmailConfig,
    });
  };

  const updateSms = (updates: Partial<SmsGatewayConfig>) => {
    onChange({
      sms: {
        ...config.sms,
        enabled: config.sms?.enabled ?? false,
        gateway: config.sms?.gateway ?? "verizon",
        phoneNumber: config.sms?.phoneNumber ?? "",
        ...updates,
      } as SmsGatewayConfig,
    });
  };

  return (
    <div class="card mb-6">
      <h2 class="text-lg font-semibold mb-4">Notifications</h2>

      {/* Email Settings */}
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="emailEnabled"
            checked={config.email?.enabled ?? false}
            onChange={(e) => updateEmail({ enabled: (e.target as HTMLInputElement).checked })}
            class="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <label for="emailEnabled" class="font-medium">
            Enable Email Notifications
          </label>
        </div>

        {config.email?.enabled && (
          <div class="ml-7 space-y-4 border-l-2 border-gray-200 pl-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">SMTP Host</label>
                <input
                  type="text"
                  class="input"
                  placeholder="smtp.gmail.com"
                  value={config.email.smtp.host}
                  onInput={(e) =>
                    updateEmail({
                      smtp: { ...config.email!.smtp, host: (e.target as HTMLInputElement).value },
                    })
                  }
                />
              </div>
              <div>
                <label class="label">SMTP Port</label>
                <input
                  type="number"
                  class="input"
                  placeholder="587"
                  value={config.email.smtp.port}
                  onInput={(e) =>
                    updateEmail({
                      smtp: { ...config.email!.smtp, port: parseInt((e.target as HTMLInputElement).value) || 587 },
                    })
                  }
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">SMTP Username</label>
                <input
                  type="text"
                  class="input"
                  placeholder="your-email@gmail.com"
                  value={config.email.smtp.auth.user}
                  onInput={(e) =>
                    updateEmail({
                      smtp: {
                        ...config.email!.smtp,
                        auth: { ...config.email!.smtp.auth, user: (e.target as HTMLInputElement).value },
                      },
                    })
                  }
                />
              </div>
              <div>
                <label class="label">SMTP Password</label>
                <input
                  type="password"
                  class="input"
                  placeholder="App password or ${SMTP_PASS}"
                  value={config.email.smtp.auth.pass}
                  onInput={(e) =>
                    updateEmail({
                      smtp: {
                        ...config.email!.smtp,
                        auth: { ...config.email!.smtp.auth, pass: (e.target as HTMLInputElement).value },
                      },
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label class="label">From Address</label>
              <input
                type="text"
                class="input"
                placeholder="LunchMonitor <alerts@example.com>"
                value={config.email.from}
                onInput={(e) => updateEmail({ from: (e.target as HTMLInputElement).value })}
              />
            </div>

            <ToAddressInput
              value={config.email.to}
              onChange={(to) => updateEmail({ to })}
            />

            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtpSecure"
                checked={config.email.smtp.secure}
                onChange={(e) =>
                  updateEmail({
                    smtp: { ...config.email!.smtp, secure: (e.target as HTMLInputElement).checked },
                  })
                }
                class="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <label for="smtpSecure" class="text-sm text-gray-600">
                Use TLS/SSL (port 465)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* SMS Settings */}
      <div>
        <div class="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            id="smsEnabled"
            checked={config.sms?.enabled ?? false}
            onChange={(e) => updateSms({ enabled: (e.target as HTMLInputElement).checked })}
            class="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <label for="smsEnabled" class="font-medium">
            Enable SMS Notifications (via Email Gateway)
          </label>
        </div>

        {config.sms?.enabled && (
          <div class="ml-7 space-y-4 border-l-2 border-gray-200 pl-4">
            <p class="text-sm text-gray-500">
              SMS uses the same SMTP settings as email. Make sure email is configured above.
            </p>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Phone Number</label>
                <input
                  type="tel"
                  class="input"
                  placeholder="5551234567"
                  value={config.sms.phoneNumber}
                  onInput={(e) => updateSms({ phoneNumber: (e.target as HTMLInputElement).value.replace(/\D/g, "") })}
                />
                <p class="mt-1 text-xs text-gray-500">10-11 digits, no dashes</p>
              </div>
              <div>
                <label class="label">Carrier</label>
                <select
                  class="input"
                  value={config.sms.gateway}
                  onChange={(e) => updateSms({ gateway: (e.target as HTMLSelectElement).value as SmsGatewayConfig["gateway"] })}
                >
                  {SMS_GATEWAYS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {config.sms.gateway === "custom" && (
              <div>
                <label class="label">Custom Gateway Domain</label>
                <input
                  type="text"
                  class="input"
                  placeholder="sms.example.com"
                  value={config.sms.customDomain ?? ""}
                  onInput={(e) => updateSms({ customDomain: (e.target as HTMLInputElement).value })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
