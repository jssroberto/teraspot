import axios from "axios";

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
