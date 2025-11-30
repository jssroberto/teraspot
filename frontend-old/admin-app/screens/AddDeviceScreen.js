import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { addDevice } from '../services/api';

export default function AddDeviceScreen({ navigation }) {
    const [deviceId, setDeviceId] = useState('');
    const [name, setName] = useState('');
    const [videoSource, setVideoSource] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!deviceId || !name || !videoSource) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const deviceData = {
                device_id: deviceId,
                name: name,
                video_source: videoSource,
                ip: '127.0.0.1', // Placeholder, in real life this might be auto-detected or manual
                port: 80
            };

            await addDevice(deviceData);
            Alert.alert('Success', 'Device registered successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to register device');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Device ID (e.g., edge-01)</Text>
            <TextInput
                style={styles.input}
                value={deviceId}
                onChangeText={setDeviceId}
                placeholder="Enter Device ID"
            />

            <Text style={styles.label}>Device Name (e.g., North Gate)</Text>
            <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter Friendly Name"
            />

            <Text style={styles.label}>Video Source (e.g., /dev/video0 or rtsp://...)</Text>
            <TextInput
                style={styles.input}
                value={videoSource}
                onChangeText={setVideoSource}
                placeholder="Enter Video Source Path/URL"
            />

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : (
                <Button title="Register Device" onPress={handleRegister} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        fontWeight: 'bold',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 20,
        borderRadius: 5,
    },
});
