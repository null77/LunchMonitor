import { useState, useCallback } from "preact/hooks";
import type { LunchMonitorConfig, AlertPolicy } from "@lunchmonitor/core";

const DEFAULT_CONFIG: LunchMonitorConfig = {
  version: "1.0",
  lunchmoney: {
    apiToken: "",
  },
  notifications: {
    email: {
      enabled: false,
      smtp: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: "",
          pass: "",
        },
      },
      from: "LunchMonitor <alerts@example.com>",
      to: [""],
    },
  },
  policies: [],
  settings: {
    checkIntervalMinutes: 360,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
};

export function useConfig() {
  const [config, setConfig] = useState<LunchMonitorConfig>(DEFAULT_CONFIG);
  const [isDirty, setIsDirty] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const updateConfig = useCallback((updates: Partial<LunchMonitorConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const updateLunchMoney = useCallback(
    (updates: Partial<LunchMonitorConfig["lunchmoney"]>) => {
      setConfig((prev) => ({
        ...prev,
        lunchmoney: { ...prev.lunchmoney, ...updates },
      }));
      setIsDirty(true);
    },
    []
  );

  const updateNotifications = useCallback(
    (updates: Partial<LunchMonitorConfig["notifications"]>) => {
      setConfig((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, ...updates },
      }));
      setIsDirty(true);
    },
    []
  );

  const updateSettings = useCallback(
    (updates: Partial<LunchMonitorConfig["settings"]>) => {
      setConfig((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...updates },
      }));
      setIsDirty(true);
    },
    []
  );

  const addPolicy = useCallback((policy: AlertPolicy) => {
    setConfig((prev) => ({
      ...prev,
      policies: [...prev.policies, policy],
    }));
    setIsDirty(true);
  }, []);

  const updatePolicy = useCallback((id: string, updates: Partial<AlertPolicy>) => {
    setConfig((prev) => ({
      ...prev,
      policies: prev.policies.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
    setIsDirty(true);
  }, []);

  const removePolicy = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      policies: prev.policies.filter((p) => p.id !== id),
    }));
    setIsDirty(true);
  }, []);

  const loadFromFile = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    setConfig(parsed);
    setFileName(file.name);
    setIsDirty(false);
  }, []);

  const exportToFile = useCallback(() => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ?? "config.json";
    a.click();
    URL.revokeObjectURL(url);
    setIsDirty(false);
  }, [config, fileName]);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setFileName(null);
    setIsDirty(false);
  }, []);

  return {
    config,
    isDirty,
    fileName,
    updateConfig,
    updateLunchMoney,
    updateNotifications,
    updateSettings,
    addPolicy,
    updatePolicy,
    removePolicy,
    loadFromFile,
    exportToFile,
    resetConfig,
  };
}
