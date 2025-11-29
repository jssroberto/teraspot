import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { getDevices, deleteDevice } from '../services/api';

export default function DashboardScreen({ navigation }) {
    const [devices, setDevices] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const handleDelete = (deviceId) => {
        Alert.alert(
            "Delete Device",
            "Are you sure you want to delete this device?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDevice(deviceId);
                            fetchDevices();
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete device");
                        }
                    }
                }
            ]
        );
    };

    const fetchDevices = async () => {
        setRefreshing(true);
        try {
            const deviceList = await getDevices();
            setDevices(deviceList);
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDevices();
        // Refresh list when focusing screen (e.g. coming back from Add Device)
        const unsubscribe = navigation.addListener('focus', () => {
            fetchDevices();
        });
        return unsubscribe;
    }, [navigation]);

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.deviceName}>{item.value.name || 'Unnamed Device'}</Text>
                <Text style={styles.deviceId}>{item.value.device_id}</Text>
            </View>
            <Text style={styles.deviceInfo}>IP: {item.value.ip}</Text>
            <Text style={styles.deviceInfo}>Source: {item.value.video_source}</Text>

            <View style={styles.buttonContainer}>
                <Button
                    title="Manage / ROI"
                    onPress={() => navigation.navigate('Editor', { device: item.value })}
                />
                <Button
                    title="Delete"
                    color="red"
                    onPress={() => handleDelete(item.value.device_id)}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Edge Processors</Text>
                <Button title="Add Device" onPress={() => navigation.navigate('AddDevice')} />
            </View>

            <FlatList
                data={devices}
                renderItem={renderItem}
                keyExtractor={(item) => item.config_id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchDevices} />
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No devices found. Add one to get started.</Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    deviceName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    deviceId: {
        fontSize: 14,
        color: '#666',
    },
    deviceInfo: {
        fontSize: 14,
        color: '#444',
        marginBottom: 5,
    },
    buttonContainer: {
        marginTop: 10,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#666',
    },
});
