import React from 'react';
import { StatusBar } from 'expo-status-bar';
import ParkingLotScreen from './screens/ParkingLotScreen';

export default function App() {
    return (
        <>
            <StatusBar style="light" />
            <ParkingLotScreen />
        </>
    );
}
