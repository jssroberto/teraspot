import axios from "axios";
import { mockKpi } from "./mock-kpi";

// TODO: Use environment variable
const API_BASE_URL =
  "https://7omj4x5pbg.execute-api.us-east-1.amazonaws.com/dev";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface Device {
  config_id: string;
  config_type: string;
  device_id: string;
  value: {
    name?: string;
    device_id: string;
    ip?: string;
    video_source?: string;
    [key: string]: any;
  };
}

export interface RoiSpace {
  space_id: string;
  polygon: number[][]; // [[x, y], [x, y], ...]
}

export interface ParkingStatus {
  space_id: string;
  status: "occupied" | "vacant" | "unknown";
}

export const getDevices = async (): Promise<Device[]> => {
  try {
    const response = await api.post("/config", {
      action: "LIST",
      config_type: "device",
    });
    return response.data.items || [];
  } catch (error) {
    console.error("Error fetching devices:", error);
    throw error;
  }
};

export const addDevice = async (deviceData: any) => {
  try {
    const response = await api.post("/config", {
      action: "SAVE",
      config: {
        config_type: "device",
        device_id: deviceData.device_id,
        value: deviceData,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error adding device:", error);
    throw error;
  }
};

export const deleteDevice = async (deviceId: string) => {
  try {
    const configId = `device-${deviceId}`;
    const response = await api.post("/config", {
      action: "DELETE",
      config_id: configId,
    });
    return response.data;
  } catch (error) {
    console.error("Error deleting device:", error);
    throw error;
  }
};

export const triggerScreenshot = async (deviceId: string) => {
  try {
    const response = await api.post(`/device/${deviceId}/command`, {
      device_id: deviceId,
      command: "screenshot",
    });
    return response.data;
  } catch (error) {
    console.error("Error triggering screenshot:", error);
    throw error;
  }
};

export const reloadConfig = async (deviceId: string) => {
  try {
    const response = await api.post(`/device/${deviceId}/command`, {
      device_id: deviceId,
      command: "reload_config",
    });
    return response.data;
  } catch (error) {
    console.error("Error reloading config:", error);
    throw error;
  }
};

export const getRoiConfig = async (deviceId: string): Promise<RoiSpace[]> => {
  try {
    const configId = `roi-${deviceId}`;
    const response = await api.post("/config", {
      action: "GET",
      config_id: configId,
    });
    return response.data.config?.value?.spaces || [];
  } catch (error) {
    console.error("Error fetching ROI config:", error);
    return [];
  }
};

export const saveRoiConfig = async (deviceId: string, spaces: RoiSpace[]) => {
  try {
    const response = await api.post("/config", {
      action: "SAVE",
      config: {
        config_type: "roi",
        device_id: deviceId,
        value: {
          spaces: spaces,
        },
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error saving ROI config:", error);
    throw error;
  }
};

export const getParkingStatus = async (): Promise<ParkingStatus[]> => {
  try {
    const response = await api.get("/status");
    return response.data.spaces || [];
  } catch (error) {
    console.error("Error fetching parking status:", error);
    return [];
  }
};

// KPI Types
export type KPIIdentifier =
  | "occupancy_rate"
  | "vacant_spaces"
  | "critical_capacity"
  | "detection_confidence"
  | "low_confidence_rate"
  | "system_health"
  | "parking_duration"
  | "peak_hours"
  | "occupancy_trend";

export interface KPIParams {
  time_window_minutes?: number;
  days_back?: number;
  hours_back?: number;
  interval_minutes?: number;
  inactive_threshold_minutes?: number;
  threshold?: number;
}

export interface KPIRequest {
  kpi: KPIIdentifier | "all";
  params?: KPIParams;
}

export interface OccupancyRateKPI {
  occupancy_rate: number;
  total_spaces: number;
  occupied_spaces: number;
  vacant_spaces: number;
  status: "OPTIMAL" | "WARNING" | "CRITICAL";
  timestamp: string;
}

export interface VacantSpacesKPI {
  total_vacant: number;
  color_code: "GREEN" | "YELLOW" | "RED";
  by_zone: Record<string, number>;
  by_facility: Record<string, number>;
  timestamp: string;
}

export interface CriticalCapacityKPI {
  alert_active: boolean;
  occupancy_rate: number;
  threshold: number;
  severity: "NORMAL" | "WARNING" | "CRITICAL";
  message: string;
  timestamp: string;
}

export interface DetectionConfidenceKPI {
  average_confidence: number;
  sample_size: number;
  quality_status: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR" | "NO_DATA";
  time_window_minutes: number;
}

export interface LowConfidenceRateKPI {
  low_confidence_rate: number;
  low_confidence_count: number;
  total_events: number;
  status: "GOOD" | "ACCEPTABLE" | "POOR" | "NO_DATA";
}

export interface SystemHealthKPI {
  uptime_percentage: number;
  active_devices: number;
  total_devices: number;
  inactive_devices: string[];
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  inactive_threshold_minutes: number;
  timestamp: string;
}

export interface ParkingDurationKPI {
  average_duration_hours: number;
  sample_size: number;
  usage_type: "SHORT_TERM" | "OFFICE_COMMUTERS" | "LONG_TERM";
  days_analyzed: number;
  timestamp: string;
}

export interface PeakHour {
  hour: number;
  occupancy_percentage: number;
}

export interface PeakHoursKPI {
  peak_hours: PeakHour[];
  hourly_breakdown: Record<string, number>;
  days_analyzed: number;
  timestamp: string;
}

export interface OccupancyTrendDataPoint {
  timestamp: string;
  occupancy_rate: number;
  occupied_count: number;
  sample_size: number;
}

export interface OccupancyTrendKPI {
  trend_data: OccupancyTrendDataPoint[];
  hours_analyzed: number;
  interval_minutes: number;
  data_points: number;
  timestamp: string;
}

export interface KPIResponse {
  level_1_operational: {
    occupancy_rate: OccupancyRateKPI;
    vacant_spaces: VacantSpacesKPI;
    critical_capacity: CriticalCapacityKPI;
  };
  level_2_performance: {
    detection_confidence: DetectionConfidenceKPI;
    low_confidence_rate: LowConfidenceRateKPI;
    system_health: SystemHealthKPI;
  };
  level_3_analytics: {
    parking_duration: ParkingDurationKPI;
    peak_hours: PeakHoursKPI;
    occupancy_trend: OccupancyTrendKPI;
  };
  metadata: {
    generated_at: string;
    version: string;
    project: string;
  };
}

export const getKPIData = async (
  params?: KPIParams
): Promise<KPIResponse> => {
  try {
    const requestBody: KPIRequest = {
      kpi: "all",
      params: params || {
        time_window_minutes: 60,
        days_back: 7,
      },
    };


    return mockKpi;
    const response = await api.post("/kpi", requestBody);
    return response.data;
  } catch (error) {
    console.error("Error fetching KPI data:", error);
    throw error;
  }
};
