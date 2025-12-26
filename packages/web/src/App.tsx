import { Layout } from "./components/Layout";
import { FileActions } from "./components/FileActions";
import { LunchMoneySettings } from "./components/LunchMoneySettings";
import { NotificationSettings } from "./components/NotificationSettings";
import { AlertPolicyEditor } from "./components/AlertPolicyEditor";
import { GeneralSettings } from "./components/GeneralSettings";
import { useConfig } from "./hooks/useConfig";

export function App() {
  const {
    config,
    isDirty,
    fileName,
    updateLunchMoney,
    updateNotifications,
    updateSettings,
    addPolicy,
    updatePolicy,
    removePolicy,
    loadFromFile,
    exportToFile,
    resetConfig,
  } = useConfig();

  return (
    <Layout>
      <FileActions
        isDirty={isDirty}
        fileName={fileName}
        onLoad={loadFromFile}
        onExport={exportToFile}
        onReset={resetConfig}
      />

      <LunchMoneySettings
        config={config.lunchmoney}
        onChange={updateLunchMoney}
      />

      <NotificationSettings
        config={config.notifications}
        onChange={updateNotifications}
      />

      <AlertPolicyEditor
        policies={config.policies}
        apiToken={config.lunchmoney.apiToken}
        apiBaseUrl={config.lunchmoney.baseUrl}
        onAdd={addPolicy}
        onUpdate={updatePolicy}
        onRemove={removePolicy}
      />

      <GeneralSettings
        settings={config.settings}
        onChange={updateSettings}
      />

      <div class="card bg-gray-50 border-dashed">
        <h3 class="font-medium mb-2">Next Steps</h3>
        <ol class="list-decimal list-inside text-sm text-gray-600 space-y-1">
          <li>Configure your LunchMoney API token above</li>
          <li>Set up email and/or SMS notifications</li>
          <li>Create alert policies with your desired thresholds</li>
          <li>Click "Export Config" to download your configuration</li>
          <li>
            Place the config file at{" "}
            <code class="bg-gray-200 px-1 rounded">~/.config/lunchmonitor/config.json</code>
          </li>
          <li>
            Set up a cron job:{" "}
            <code class="bg-gray-200 px-1 rounded text-xs">
              0 */6 * * * lunchmonitor check
            </code>
          </li>
        </ol>
      </div>
    </Layout>
  );
}
