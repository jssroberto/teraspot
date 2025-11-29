import axios from 'axios';

const API_BASE_url = 'https://7omj4x5pbg.execute-api.us-east-1.amazonaws.com/dev';

const api = axios.create({
    baseURL: API_BASE_url,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getDevices = async () => {
    try {
        const response = await api.post('/config', {
            action: 'LIST',
            config_type: 'device',
        });
        return response.data.items || [];
    } catch (error) {
        console.error('Error fetching devices:', error);
        throw error;
    }
};

export const addDevice = async (deviceData) => {
    try {
        const response = await api.post('/config', {
            action: 'SAVE',
            config: {
                config_type: 'device',
                device_id: deviceData.device_id,
                value: deviceData,
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error adding device:', error);
        throw error;
    }
};

export const deleteDevice = async (deviceId) => {
    try {
        const configId = `device-${deviceId}`;
        const response = await api.post('/config', {
            action: 'DELETE',
            config_id: configId,
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting device:', error);
        throw error;
    }
};

export const triggerScreenshot = async (deviceId) => {
    try {
        const response = await api.post(`/device/${deviceId}/command`, {
            device_id: deviceId,
            command: 'screenshot',
        });
        return response.data;
    } catch (error) {
        console.error('Error triggering screenshot:', error);
        throw error;
    }
};

export const reloadConfig = async (deviceId) => {
    try {
        const response = await api.post(`/device/${deviceId}/command`, {
            device_id: deviceId,
            command: 'reload_config',
        });
        return response.data;
    } catch (error) {
        console.error('Error reloading config:', error);
        throw error;
    }
};

export const getRoiConfig = async (deviceId) => {
    try {
        const configId = `roi-${deviceId}`;
        const response = await api.post('/config', {
            action: 'GET',
            config_id: configId,
        });
        // Return the spaces list if it exists, or empty list
        return response.data.config?.value?.spaces || [];
    } catch (error) {
        console.error('Error fetching ROI config:', error);
        // If config doesn't exist, return empty list
        return [];
    }
};

export const saveRoiConfig = async (deviceId, spaces) => {
    try {
        const response = await api.post('/config', {
            action: 'SAVE',
            config: {
                config_type: 'roi',
                device_id: deviceId,
                value: {
                    spaces: spaces,
                },
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error saving ROI config:', error);
        throw error;
    }
};
