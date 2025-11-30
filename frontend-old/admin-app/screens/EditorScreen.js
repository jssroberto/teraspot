import React, { useState, useEffect } from 'react';
import { View, Text, Image, Button, StyleSheet, Dimensions, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import Svg, { Polygon, Circle } from 'react-native-svg';
import { triggerScreenshot, getRoiConfig, saveRoiConfig, reloadConfig } from '../services/api';

export default function EditorScreen({ route, navigation }) {
    const { device } = route.params;
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [polygons, setPolygons] = useState([]);
    const [currentPoints, setCurrentPoints] = useState([]);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [imageMeta, setImageMeta] = useState({ width: 1, height: 1 }); // Actual image dims
    const [zoomScale, setZoomScale] = useState(1);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const screenshotData = await triggerScreenshot(device.device_id);
            const downloadUrl = screenshotData.download_url;

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get actual image dimensions
            Image.getSize(downloadUrl, (width, height) => {
                setImageMeta({ width, height });
            });

            setImageUrl(downloadUrl);

            const existingSpaces = await getRoiConfig(device.device_id);
            if (existingSpaces && existingSpaces.length > 0) {
                setPolygons(existingSpaces);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleContainerLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
    };

    // Calculate the actual displayed rectangle of the image within the container
    const getDisplayedImageRect = () => {
        if (!containerSize.width || !containerSize.height) return { x: 0, y: 0, width: 0, height: 0 };

        const containerAspect = containerSize.width / containerSize.height;
        const imageAspect = imageMeta.width / imageMeta.height;

        let renderWidth, renderHeight, offsetX, offsetY;

        if (containerAspect > imageAspect) {
            // Container is wider than image -> Image fits height
            renderHeight = containerSize.height;
            renderWidth = renderHeight * imageAspect;
            offsetX = (containerSize.width - renderWidth) / 2;
            offsetY = 0;
        } else {
            // Container is taller than image -> Image fits width
            renderWidth = containerSize.width;
            renderHeight = renderWidth / imageAspect;
            offsetX = 0;
            offsetY = (containerSize.height - renderHeight) / 2;
        }

        return { x: offsetX, y: offsetY, width: renderWidth, height: renderHeight };
    };

    const handleTouch = (event) => {
        const { locationX, locationY } = event.nativeEvent;
        const rect = getDisplayedImageRect();

        if (
            locationX < rect.x ||
            locationX > rect.x + rect.width ||
            locationY < rect.y ||
            locationY > rect.y + rect.height
        ) {
            return;
        }

        let x = (locationX - rect.x) / rect.width;
        let y = (locationY - rect.y) / rect.height;

        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        setCurrentPoints([...currentPoints, [x, y]]);
    };

    const undoLastPoint = () => {
        if (currentPoints.length > 0) {
            setCurrentPoints(currentPoints.slice(0, -1));
        }
    };

    const finishPolygon = () => {
        if (currentPoints.length < 3) {
            Alert.alert('Error', 'A polygon must have at least 3 points');
            return;
        }
        const newSpaceId = `space-${polygons.length + 1}`;
        setPolygons([...polygons, { space_id: newSpaceId, polygon: currentPoints }]);
        setCurrentPoints([]);
    };

    const clearAll = () => {
        setPolygons([]);
        setCurrentPoints([]);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await saveRoiConfig(device.device_id, polygons);
            await reloadConfig(device.device_id);
            Alert.alert('Success', 'ROI Configuration Saved & Device Reloaded');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save config or reload device');
        } finally {
            setLoading(false);
        }
    };

    const handleReload = async () => {
        setLoading(true);
        try {
            await reloadConfig(device.device_id);
            Alert.alert('Success', 'Device Reload Triggered');
        } catch (error) {
            Alert.alert('Error', 'Failed to reload device');
        } finally {
            setLoading(false);
        }
    };

    const getPointsString = (points) => {
        const rect = getDisplayedImageRect();
        return points.map(p => {
            const px = rect.x + (p[0] * rect.width);
            const py = rect.y + (p[1] * rect.height);
            return `${px},${py}`;
        }).join(' ');
    };

    return (
        <View style={styles.container}>
            <View style={styles.toolbar}>
                <Button title="Save" onPress={handleSave} disabled={loading} />
                <Button title="Reload" onPress={handleReload} disabled={loading} />
                <Button title="Clear" onPress={clearAll} color="red" />
                <View style={styles.zoomControls}>
                    <Button title="-" onPress={() => setZoomScale(Math.max(1, zoomScale - 0.5))} />
                    <Text style={styles.zoomText}>{zoomScale}x</Text>
                    <Button title="+" onPress={() => setZoomScale(Math.min(4, zoomScale + 0.5))} />
                </View>
            </View>

            <View style={styles.imageWrapper}>
                {loading && <ActivityIndicator style={styles.loader} size="large" color="#0000ff" />}

                <View
                    style={[styles.zoomContainer, { transform: [{ scale: zoomScale }] }]}
                    onLayout={handleContainerLayout}
                >
                    {imageUrl && (
                        <TouchableOpacity activeOpacity={1} onPress={handleTouch} style={styles.touchableArea}>
                            <Image
                                source={{ uri: imageUrl }}
                                style={styles.image}
                                resizeMode="contain"
                            />

                            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                                {polygons.map((poly, index) => (
                                    <Polygon
                                        key={index}
                                        points={getPointsString(poly.polygon)}
                                        fill="rgba(0, 255, 0, 0.3)"
                                        stroke="lime"
                                        strokeWidth={2 / zoomScale} // Keep stroke thin when zoomed
                                    />
                                ))}

                                {currentPoints.length > 0 && (
                                    <>
                                        <Polygon
                                            points={getPointsString(currentPoints)}
                                            fill="rgba(0, 0, 255, 0.3)"
                                            stroke="blue"
                                            strokeWidth={2 / zoomScale}
                                        />
                                        {currentPoints.map((p, i) => {
                                            const rect = getDisplayedImageRect();
                                            const cx = rect.x + (p[0] * rect.width);
                                            const cy = rect.y + (p[1] * rect.height);
                                            return (
                                                <Circle
                                                    key={i}
                                                    cx={cx}
                                                    cy={cy}
                                                    r={4 / zoomScale}
                                                    fill="blue"
                                                />
                                            );
                                        })}
                                    </>
                                )}
                            </Svg>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.footer}>
                <Button title="Undo Point" onPress={undoLastPoint} disabled={currentPoints.length === 0} />
                <Button title="Finish Polygon" onPress={finishPolygon} disabled={currentPoints.length < 3} />
                <Button title="Del Last Shape" onPress={() => setPolygons(polygons.slice(0, -1))} disabled={polygons.length === 0} color="orange" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#333',
        zIndex: 10,
    },
    zoomControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#444',
        borderRadius: 5,
        marginLeft: 10,
    },
    zoomText: {
        color: 'white',
        marginHorizontal: 10,
    },
    imageWrapper: {
        flex: 1,
        overflow: 'hidden', // Clip content when zoomed
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    touchableArea: {
        width: '100%',
        height: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    loader: {
        position: 'absolute',
        zIndex: 1,
        alignSelf: 'center',
        top: '50%',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#333',
        zIndex: 10,
    },
});
