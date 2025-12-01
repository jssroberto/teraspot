import { KPIResponse } from "./api";

export const mockKpi: KPIResponse = {
    "level_1_operational": {
        "occupancy_rate": {
            "occupancy_rate": 66.67,
            "total_spaces": 6,
            "occupied_spaces": 4,
            "vacant_spaces": 2,
            "status": "OPTIMAL",
            "timestamp": "2025-12-01T05:09:39.319047+00:00"
        },
        "vacant_spaces": {
            "total_vacant": 2,
            "color_code": "RED",
            "by_zone": {
                "zone-a": 2
            },
            "by_facility": {
                "demo-facility": 2
            },
            "timestamp": "2025-12-01T05:09:39.319509+00:00"
        },
        "critical_capacity": {
            "alert_active": false,
            "occupancy_rate": 66.67,
            "threshold": 95.0,
            "severity": "NORMAL",
            "message": "Capacidad normal",
            "timestamp": "2025-12-01T05:09:39.319869+00:00"
        }
    },
    "level_2_performance": {
        "detection_confidence": {
            "average_confidence": 0.0,
            "sample_size": 0,
            "quality_status": "NO_DATA",
            "time_window_minutes": 15
        },
        "low_confidence_rate": {
            "low_confidence_rate": 0.0,
            "low_confidence_count": 0,
            "total_events": 0,
            "status": "NO_DATA"
        },
        "system_health": {
            "uptime_percentage": 0.0,
            "active_devices": 0,
            "total_devices": 1,
            "inactive_devices": [
                "teraspot-edge-device"
            ],
            "status": "DEGRADED",
            "inactive_threshold_minutes": 5,
            "timestamp": "2025-12-01T05:09:39.321713+00:00"
        }
    },
    "level_3_analytics": {
        "parking_duration": {
            "average_duration_hours": 3.87,
            "sample_size": 160,
            "usage_type": "OFFICE_COMMUTERS",
            "days_analyzed": 7,
            "timestamp": "2025-12-01T05:09:39.365125+00:00"
        },
        "peak_hours": {
            "peak_hours": [
                {
                    "hour": 0,
                    "occupancy_percentage": 100.0
                },
                {
                    "hour": 1,
                    "occupancy_percentage": 100.0
                },
                {
                    "hour": 2,
                    "occupancy_percentage": 100.0
                },
                {
                    "hour": 3,
                    "occupancy_percentage": 100.0
                },
                {
                    "hour": 5,
                    "occupancy_percentage": 100.0
                }
            ],
            "hourly_breakdown": {
                "0": 100.0,
                "1": 100.0,
                "2": 100.0,
                "3": 100.0,
                "4": 0.0,
                "5": 100.0,
                "6": 66.67,
                "7": 75.0,
                "8": 60.0,
                "9": 54.39,
                "10": 51.52,
                "11": 41.67,
                "12": 54.55,
                "13": 36.94,
                "14": 53.62,
                "15": 56.25,
                "16": 61.73,
                "17": 50.0,
                "18": 38.24,
                "19": 34.69,
                "20": 33.03,
                "21": 40.7,
                "22": 41.67,
                "23": 89.19
            },
            "days_analyzed": 30,
            "timestamp": "2025-12-01T05:09:39.381527+00:00"
        },
        "occupancy_trend": {
            "trend_data": [
                {
                    "timestamp": "2025-11-30T05:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 1
                },
                {
                    "timestamp": "2025-11-30T06:09:39.382013+00:00",
                    "occupancy_rate": 100.0,
                    "occupied_count": 1,
                    "sample_size": 1
                },
                {
                    "timestamp": "2025-11-30T07:09:39.382013+00:00",
                    "occupancy_rate": 100.0,
                    "occupied_count": 2,
                    "sample_size": 2
                },
                {
                    "timestamp": "2025-11-30T08:09:39.382013+00:00",
                    "occupancy_rate": 33.33,
                    "occupied_count": 1,
                    "sample_size": 3
                },
                {
                    "timestamp": "2025-11-30T09:09:39.382013+00:00",
                    "occupancy_rate": 50.0,
                    "occupied_count": 1,
                    "sample_size": 2
                },
                {
                    "timestamp": "2025-11-30T10:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 1
                },
                {
                    "timestamp": "2025-11-30T11:09:39.382013+00:00",
                    "occupancy_rate": 50.0,
                    "occupied_count": 2,
                    "sample_size": 4
                },
                {
                    "timestamp": "2025-11-30T12:09:39.382013+00:00",
                    "occupancy_rate": 100.0,
                    "occupied_count": 1,
                    "sample_size": 1
                },
                {
                    "timestamp": "2025-11-30T13:09:39.382013+00:00",
                    "occupancy_rate": 40.0,
                    "occupied_count": 2,
                    "sample_size": 5
                },
                {
                    "timestamp": "2025-11-30T14:09:39.382013+00:00",
                    "occupancy_rate": 66.67,
                    "occupied_count": 2,
                    "sample_size": 3
                },
                {
                    "timestamp": "2025-11-30T15:09:39.382013+00:00",
                    "occupancy_rate": 25.0,
                    "occupied_count": 1,
                    "sample_size": 4
                },
                {
                    "timestamp": "2025-11-30T16:09:39.382013+00:00",
                    "occupancy_rate": 75.0,
                    "occupied_count": 3,
                    "sample_size": 4
                },
                {
                    "timestamp": "2025-11-30T17:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 1
                },
                {
                    "timestamp": "2025-11-30T18:09:39.382013+00:00",
                    "occupancy_rate": 40.0,
                    "occupied_count": 2,
                    "sample_size": 5
                },
                {
                    "timestamp": "2025-11-30T19:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 3
                },
                {
                    "timestamp": "2025-11-30T20:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-11-30T21:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-11-30T22:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-11-30T23:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-12-01T00:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-12-01T01:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-12-01T02:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-12-01T03:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-12-01T04:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                },
                {
                    "timestamp": "2025-12-01T05:09:39.382013+00:00",
                    "occupancy_rate": 0.0,
                    "occupied_count": 0,
                    "sample_size": 0
                }
            ],
            "hours_analyzed": 24,
            "interval_minutes": 60,
            "data_points": 25,
            "timestamp": "2025-12-01T05:09:39.430149+00:00"
        }
    },
    "metadata": {
        "generated_at": "2025-12-01T05:09:39.430626+00:00",
        "version": "1.0.0",
        "project": "TeraSpot - Sistema Inteligente de Gesti\u00f3n de Estacionamientos"
    }
}