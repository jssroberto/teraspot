import { getAlertConfig } from "@repo/core";
import { useCallback, useEffect, useState } from "react";

export interface AlertSettings {
  occupancy_threshold_critical: number;
  occupancy_threshold_warning: number;
  confidence_threshold: number;
  inactive_timeout_minutes: number;
  channels: {
    email: boolean;
    app: boolean;
  };
}

const DEFAULT_SETTINGS: AlertSettings = {
  occupancy_threshold_critical: 95,
  occupancy_threshold_warning: 80,
  confidence_threshold: 0.8,
  inactive_timeout_minutes: 5,
  channels: {
    email: true,
    app: true,
  },
};

export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const config = await getAlertConfig();
      if (config && Object.keys(config).length > 0) {
        // Merge with defaults to ensure all fields exist
        setSettings({
          ...DEFAULT_SETTINGS,
          ...config,
          channels: {
            ...DEFAULT_SETTINGS.channels,
            ...config.channels,
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch alert settings:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refresh: fetchSettings };
}
