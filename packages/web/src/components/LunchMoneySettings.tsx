import { useState } from "preact/hooks";
import type { LunchMonitorConfig } from "@lunchmonitor/core";
import { resolveBaseUrl, DEFAULT_BASE_URL } from "@lunchmonitor/core/base-url";

interface LunchMoneySettingsProps {
  config: LunchMonitorConfig["lunchmoney"];
  onChange: (updates: Partial<LunchMonitorConfig["lunchmoney"]>) => void;
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

export function LunchMoneySettings({ config, onChange }: LunchMoneySettingsProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const handleTestConnection = async () => {
    if (!config.apiToken) {
      setTestStatus("error");
      setTestMessage("Please enter an API token first");
      return;
    }

    setTestStatus("testing");
    setTestMessage("");

    try {
      const baseUrl = resolveBaseUrl(config.baseUrl);
      const response = await fetch(`${baseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        const userName = decodeHtmlEntities(user.name);
        const budgetName = decodeHtmlEntities(user.budget_name);
        setTestStatus("success");
        setTestMessage(`Connected as ${userName} (${budgetName})`);
      } else {
        const error = await response.text();
        setTestStatus("error");
        setTestMessage(`API error: ${error}`);
      }
    } catch (err) {
      setTestStatus("error");
      setTestMessage(`Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <div class="card mb-6">
      <h2 class="text-lg font-semibold mb-4">LunchMoney API</h2>

      <div class="space-y-4">
        <div>
          <label class="label" for="apiToken">
            API Token
          </label>
          <div class="flex gap-2">
            <input
              id="apiToken"
              type="password"
              class="input flex-1"
              placeholder="Enter your LunchMoney API token"
              value={config.apiToken}
              onInput={(e) => onChange({ apiToken: (e.target as HTMLInputElement).value })}
            />
            <button
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              class="btn-secondary"
            >
              {testStatus === "testing" ? "Testing..." : "Test"}
            </button>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Get your API token from{" "}
            <a
              href="https://my.lunchmoney.app/developers"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 hover:text-primary-700"
            >
              LunchMoney Developer Settings
            </a>
          </p>
          {testMessage && (
            <p class={`mt-2 text-sm ${testStatus === "success" ? "text-green-600" : "text-red-600"}`}>
              {testMessage}
            </p>
          )}
        </div>

        <div>
          <label class="label" for="baseUrl">
            API Base URL (Optional)
          </label>
          <input
            id="baseUrl"
            type="url"
            class="input"
            placeholder={DEFAULT_BASE_URL}
            value={config.baseUrl ?? ""}
            onInput={(e) => {
              const value = (e.target as HTMLInputElement).value;
              onChange({ baseUrl: value || undefined });
            }}
          />
          <p class="mt-1 text-sm text-gray-500">
            Leave empty to use the default API endpoint
          </p>
        </div>
      </div>
    </div>
  );
}
