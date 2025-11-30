import axios from 'axios';

const API_BASE_url = 'https://7omj4x5pbg.execute-api.us-east-1.amazonaws.com/dev';

const api = axios.create({
    baseURL: API_BASE_url,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getRoiConfig = async (deviceId) => {
    try {
        const configId = `roi-${deviceId}`;
        const response = await api.post('/config', {
            action: 'GET',
            config_id: configId,
        });
        return response.data.config?.value?.spaces || [];
    } catch (error) {
        console.error('Error fetching ROI config:', error);
        return [];
    }
};

export const getParkingStatus = async () => {
    try {
        const response = await api.get('/status');
        return response.data.spaces || [];
    } catch (error) {
        console.error('Error fetching parking status:', error);
        return [];
    }
};
