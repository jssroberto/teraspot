import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import { getRoiConfig, getParkingStatus } from '../services/api';

const DEVICE_ID = 'TeraSpot-edge-device'; // Hardcoded for demo

export default function ParkingLotScreen() {
    const [polygons, setPolygons] = useState([]);
    const [statuses, setStatuses] = useState({});
    const [loading, setLoading] = useState(true);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [viewMode, setViewMode] = useState('map'); // 'map' or 'grid'

    // We assume a standard 16:9 aspect ratio for the parking lot view if no image is present
    // In a real app, this might come from the config or the background image
    const ASPECT_RATIO = 16 / 9;

    useEffect(() => {
        loadConfig();
        const interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, []);

    const loadConfig = async () => {
        try {
            const spaces = await getRoiConfig(DEVICE_ID);
            setPolygons(spaces);
            await fetchStatus();
        } catch (error) {
            console.error('Failed to load config', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatus = async () => {
        try {
            const spaces = await getParkingStatus();
            const statusMap = {};
            spaces.forEach(space => {
                statusMap[space.space_id] = space.status;
            });
            setStatuses(statusMap);
        } catch (error) {
            console.error('Failed to fetch status', error);
        }
    };

    const handleLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
    };

    const getDisplayedRect = () => {
        if (!containerSize.width || !containerSize.height) return { x: 0, y: 0, width: 0, height: 0 };

        const containerAspect = containerSize.width / containerSize.height;
        let renderWidth, renderHeight, offsetX, offsetY;

        if (containerAspect > ASPECT_RATIO) {
            renderHeight = containerSize.height;
            renderWidth = renderHeight * ASPECT_RATIO;
            offsetX = (containerSize.width - renderWidth) / 2;
            offsetY = 0;
        } else {
            renderWidth = containerSize.width;
            renderHeight = renderWidth / ASPECT_RATIO;
            offsetX = 0;
            offsetY = (containerSize.height - renderHeight) / 2;
        }

        return { x: offsetX, y: offsetY, width: renderWidth, height: renderHeight };
    };

    const getPointsString = (points) => {
        const rect = getDisplayedRect();
        return points.map(p => {
            const px = rect.x + (p[0] * rect.width);
            const py = rect.y + (p[1] * rect.height);
            return `${px},${py}`;
        }).join(' ');
    };

    const getLabelPosition = (points) => {
        const rect = getDisplayedRect();
        let sumX = 0, sumY = 0;
        points.forEach(p => {
            sumX += p[0];
            sumY += p[1];
        });
        const centerX = rect.x + (sumX / points.length) * rect.width;
        const centerY = rect.y + (sumY / points.length) * rect.height;
        return { x: centerX, y: centerY };
    };

    const getStatusColor = (spaceId) => {
        const status = statuses[spaceId];
        if (status === 'occupied') return 'rgba(255, 0, 0, 0.6)'; // Red
        if (status === 'vacant') return 'rgba(0, 255, 0, 0.6)';   // Green
        return 'rgba(128, 128, 128, 0.3)'; // Grey (Unknown)
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Parking Availability</Text>
                <View style={styles.controls}>
                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: 'green' }]} />
                            <Text style={styles.legendText}>Vacant</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.dot, { backgroundColor: 'red' }]} />
                            <Text style={styles.legendText}>Occupied</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.toggleButton}
                        onPress={() => setViewMode(viewMode === 'map' ? 'grid' : 'map')}
                    >
                        <Text style={styles.toggleText}>
                            {viewMode === 'map' ? 'Switch to Grid' : 'Switch to Map'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {viewMode === 'map' ? (
                <View style={styles.mapContainer} onLayout={handleLayout}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#fff" />
                    ) : (
                        <Svg style={StyleSheet.absoluteFill}>
                            {polygons.map((poly, index) => {
                                const labelPos = getLabelPosition(poly.polygon);
                                return (
                                    <React.Fragment key={index}>
                                        <Polygon
                                            points={getPointsString(poly.polygon)}
                                            fill={getStatusColor(poly.space_id)}
                                            stroke="white"
                                            strokeWidth="2"
                                        />
                                        <SvgText
                                            x={labelPos.x}
                                            y={labelPos.y}
                                            fill="white"
                                            fontSize="12"
                                            fontWeight="bold"
                                            textAnchor="middle"
                                            alignmentBaseline="middle"
                                        >
                                            {poly.space_id.replace('space-', '')}
                                        </SvgText>
                                    </React.Fragment>
                                );
                            })}
                        </Svg>
                    )}
                </View>
            ) : (
                <ScrollView style={styles.gridContainer}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#fff" />
                    ) : (
                        <View style={styles.grid}>
                            {polygons.map((poly, index) => {
                                const id = poly.space_id.replace('space-', '');
                                const status = statuses[poly.space_id];
                                const isOccupied = status === 'occupied';
                                return (
                                    <View key={index} style={[
                                        styles.gridItem,
                                        { backgroundColor: isOccupied ? '#ff4444' : '#44ff44' }
                                    ]}>
                                        <Text style={styles.gridText}>{id}</Text>
                                        <Text style={styles.statusText}>{isOccupied ? 'OCCUPIED' : 'VACANT'}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    header: {
        padding: 20,
        paddingTop: 50,
        backgroundColor: '#333',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 10,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
    },
    legend: {
        flexDirection: 'row',
        gap: 20,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    legendText: {
        color: 'white',
    },
    toggleButton: {
        backgroundColor: '#555',
        padding: 8,
        borderRadius: 5,
    },
    toggleText: {
        color: 'white',
        fontWeight: 'bold',
    },
    mapContainer: {
        flex: 1,
        margin: 20,
        backgroundColor: '#000',
        borderRadius: 10,
        overflow: 'hidden',
    },
    gridContainer: {
        flex: 1,
        padding: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        paddingBottom: 40,
    },
    gridItem: {
        width: 80,
        height: 80,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    gridText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 5,
    },
});
