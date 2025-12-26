import type { LunchMonitorConfig } from "@lunchmonitor/core";

interface GeneralSettingsProps {
  settings: LunchMonitorConfig["settings"];
  onChange: (updates: Partial<LunchMonitorConfig["settings"]>) => void;
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "UTC",
];

export function GeneralSettings({ settings, onChange }: GeneralSettingsProps) {
  return (
    <div class="card mb-6">
      <h2 class="text-lg font-semibold mb-4">General Settings</h2>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Timezone</label>
            <select
              class="input"
              value={settings.timezone}
              onChange={(e) => onChange({ timezone: (e.target as HTMLSelectElement).value })}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label class="label">Currency (Optional)</label>
            <input
              type="text"
              class="input"
              placeholder="USD"
              value={settings.currency ?? ""}
              onInput={(e) => {
                const value = (e.target as HTMLInputElement).value;
                onChange({ currency: value || undefined });
              }}
            />
          </div>
        </div>

        <div>
          <label class="label">Check Interval (minutes)</label>
          <input
            type="number"
            class="input w-48"
            min={60}
            step={60}
            value={settings.checkIntervalMinutes}
            onInput={(e) =>
              onChange({ checkIntervalMinutes: parseInt((e.target as HTMLInputElement).value) || 360 })
            }
          />
          <p class="mt-1 text-sm text-gray-500">
            Recommended: 360 (6 hours). This is for reference only - actual frequency is set in cron.
          </p>
        </div>

        <div>
          <div class="flex items-center gap-3 mb-2">
            <input
              type="checkbox"
              id="quietHoursEnabled"
              checked={!!settings.quietHours}
              onChange={(e) => {
                if ((e.target as HTMLInputElement).checked) {
                  onChange({ quietHours: { start: "22:00", end: "08:00" } });
                } else {
                  onChange({ quietHours: undefined });
                }
              }}
              class="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label for="quietHoursEnabled" class="font-medium">
              Enable Quiet Hours
            </label>
          </div>

          {settings.quietHours && (
            <div class="ml-7 grid grid-cols-2 gap-4 max-w-xs">
              <div>
                <label class="label">Start</label>
                <input
                  type="time"
                  class="input"
                  value={settings.quietHours.start}
                  onInput={(e) =>
                    onChange({
                      quietHours: {
                        ...settings.quietHours!,
                        start: (e.target as HTMLInputElement).value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label class="label">End</label>
                <input
                  type="time"
                  class="input"
                  value={settings.quietHours.end}
                  onInput={(e) =>
                    onChange({
                      quietHours: {
                        ...settings.quietHours!,
                        end: (e.target as HTMLInputElement).value,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
          <p class="mt-1 text-sm text-gray-500 ml-7">
            No notifications will be sent during quiet hours
          </p>
        </div>
      </div>
    </div>
  );
}
