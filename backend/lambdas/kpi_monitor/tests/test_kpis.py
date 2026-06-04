import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from kpi_monitor_handler import (
    calculate_average_parking_duration,
    check_critical_capacity_alert,
    get_available_spaces_by_zone,
    get_average_detection_confidence,
    get_current_occupancy_rate,
    get_low_confidence_event_rate,
    get_occupancy_trend,
    get_peak_occupancy_hours,
    get_system_health_device_uptime,
    lambda_handler,
)


class TestKPILambda:
    """Unit tests for KPI Lambda - TeraSpot"""

    # ========================================================================
    # FIXTURES - Datos Mock para Tests
    # ========================================================================

    @pytest.fixture
    def mock_current_table_data(self):
        """Mock data for current table (parking-spaces-dev)"""
        now = datetime.now(timezone.utc)
        return [
            {
                "space_id": "SPACE-001",
                "status": "occupied",
                "confidence": Decimal("0.95"),
                "timestamp": now.isoformat(),
                "device_id": "jetson-nano-001",
                "zone_id": "ZONE_A",
                "facility_id": "FACILITY_1",
            },
            {
                "space_id": "SPACE-002",
                "status": "vacant",
                "confidence": Decimal("0.92"),
                "timestamp": now.isoformat(),
                "device_id": "jetson-nano-002",
                "zone_id": "ZONE_A",
                "facility_id": "FACILITY_1",
            },
            {
                "space_id": "SPACE-003",
                "status": "occupied",
                "confidence": Decimal("0.70"),  # Low confidence
                "timestamp": now.isoformat(),
                "device_id": "jetson-nano-003",
                "zone_id": "ZONE_B",
                "facility_id": "FACILITY_2",
            },
            {
                "space_id": "SPACE-004",
                "status": "occupied",
                "confidence": Decimal("0.88"),
                "timestamp": (
                    now - timedelta(minutes=10)
                ).isoformat(),  # Inactive device
                "device_id": "jetson-nano-004",
                "zone_id": "ZONE_B",
                "facility_id": "FACILITY_2",
            },
            {
                "space_id": "SPACE-005",
                "status": "vacant",
                "confidence": Decimal("0.96"),
                "timestamp": now.isoformat(),
                "device_id": "jetson-nano-001",
                "zone_id": "ZONE_C",
                "facility_id": "FACILITY_1",
            },
        ]

    @pytest.fixture
    def mock_history_table_data(self):
        """Mock data for history table (parking-history)"""
        now = datetime.now(timezone.utc)
        base_time = now - timedelta(days=7)

        history = []
        # Simular sesión de estacionamiento completa
        for i in range(10):
            entry_time = base_time + timedelta(hours=i * 3)
            exit_time = entry_time + timedelta(hours=2)  # 2 horas de duración

            # Entrada
            history.append(
                {
                    "space_id": f"SPACE-{i:03d}",
                    "timestamp": entry_time.isoformat(),
                    "status": "occupied",
                    "confidence": Decimal("0.92"),
                    "device_id": f"jetson-nano-{i:03d}",
                }
            )

            # Salida
            history.append(
                {
                    "space_id": f"SPACE-{i:03d}",
                    "timestamp": exit_time.isoformat(),
                    "status": "vacant",
                    "confidence": Decimal("0.90"),
                    "device_id": f"jetson-nano-{i:03d}",
                }
            )

        return history

    @pytest.fixture
    def mock_dynamodb_current_table(self, mock_current_table_data):
        """Mock DynamoDB current table"""
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": mock_current_table_data}
        return mock_table

    @pytest.fixture
    def mock_dynamodb_history_table(self, mock_history_table_data):
        """Mock DynamoDB history table"""
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": mock_history_table_data}
        return mock_table

    # ========================================================================
    # TESTS - NIVEL 1: MÉTRICAS OPERACIONALES
    # ========================================================================

    @patch("kpi_monitor_handler.current_table")
    def test_get_current_occupancy_rate_normal(
        self, mock_table, mock_current_table_data
    ):
        """Test: Calculate current occupancy rate - normal status"""
        mock_table.scan.return_value = {"Items": mock_current_table_data}

        result = get_current_occupancy_rate()

        assert "occupancy_rate" in result
        assert result["total_spaces"] == 5
        assert result["occupied_spaces"] == 3
        assert result["vacant_spaces"] == 2
        assert result["occupancy_rate"] == 60.0  # 3/5 * 100
        assert result["status"] == "OPTIMAL"  # 60% está en rango 60-85%

    @patch("kpi_monitor_handler.current_table")
    def test_get_current_occupancy_rate_critical(self, mock_table):
        """Test: Calculate occupancy rate - critical status (>90%)"""
        # Crear datos con 95% de ocupación
        critical_data = [
            {"space_id": f"SPACE-{i:03d}", "status": "occupied" if i < 95 else "vacant"}
            for i in range(100)
        ]
        mock_table.scan.return_value = {"Items": critical_data}

        result = get_current_occupancy_rate()

        assert result["occupancy_rate"] == 95.0
        assert result["status"] == "CRITICAL"

    @patch("kpi_monitor_handler.current_table")
    def test_get_current_occupancy_rate_no_data(self, mock_table):
        """Test: Calculate occupancy rate - no data available"""
        mock_table.scan.return_value = {"Items": []}

        result = get_current_occupancy_rate()

        assert result["occupancy_rate"] == 0.0
        assert result["total_spaces"] == 0
        assert result["status"] == "NO_DATA"

    @patch("kpi_monitor_handler.current_table")
    def test_get_available_spaces_by_zone(self, mock_table, mock_current_table_data):
        """Test: Get vacant spaces grouped by zone and facility"""
        mock_table.scan.return_value = {"Items": mock_current_table_data}

        result = get_available_spaces_by_zone()

        assert result["total_vacant"] == 2
        assert result["color_code"] == "RED"  # <5 spaces
        assert "ZONE_A" in result["by_zone"]
        assert "ZONE_C" in result["by_zone"]
        assert "ZONE_C" in result["by_zone"]

        by_zone = result["by_zone"]
        assert isinstance(by_zone, dict)
        assert by_zone["ZONE_A"] == 1
        assert by_zone["ZONE_C"] == 1

    @patch("kpi_monitor_handler.current_table")
    def test_get_available_spaces_color_codes(self, mock_table):
        """Test: Vacant spaces color codes (GREEN, YELLOW, RED)"""
        # Test GREEN (>20)
        green_data = [{"space_id": f"S{i}", "status": "vacant"} for i in range(25)]
        mock_table.scan.return_value = {"Items": green_data}
        result = get_available_spaces_by_zone()
        assert result["color_code"] == "GREEN"

        # Test YELLOW (5-20)
        yellow_data = [{"space_id": f"S{i}", "status": "vacant"} for i in range(10)]
        mock_table.scan.return_value = {"Items": yellow_data}
        result = get_available_spaces_by_zone()
        assert result["color_code"] == "YELLOW"

        # Test RED (<5)
        red_data = [{"space_id": f"S{i}", "status": "vacant"} for i in range(3)]
        mock_table.scan.return_value = {"Items": red_data}
        result = get_available_spaces_by_zone()
        assert result["color_code"] == "RED"

    @patch("kpi_monitor_handler.get_current_occupancy_rate")
    def test_check_critical_capacity_alert_active(self, mock_occupancy):
        """Test: Critical capacity alert - ACTIVE (≥95%)"""
        mock_occupancy.return_value = {
            "occupancy_rate": 96.5,
            "occupied_spaces": 193,
            "total_spaces": 200,
        }

        result = check_critical_capacity_alert()

        assert result["alert_active"] is True
        assert result["severity"] == "CRITICAL"
        assert result["threshold"] == 95.0

    @patch("kpi_monitor_handler.get_current_occupancy_rate")
    def test_check_critical_capacity_alert_inactive(self, mock_occupancy):
        """Test: Critical capacity alert - INACTIVE (<95%)"""
        mock_occupancy.return_value = {
            "occupancy_rate": 82.0,
            "occupied_spaces": 164,
            "total_spaces": 200,
        }

        result = check_critical_capacity_alert()

        assert result["alert_active"] is False
        assert result["severity"] == "NORMAL"

    # ========================================================================
    # TESTS - NIVEL 2: MÉTRICAS DE RENDIMIENTO
    # ========================================================================

    @patch("kpi_monitor_handler.current_table")
    def test_get_average_detection_confidence_excellent(
        self, mock_table, mock_current_table_data
    ):
        """Test: Average detection confidence - EXCELLENT (>85%)"""
        mock_table.scan.return_value = {"Items": mock_current_table_data}

        result = get_average_detection_confidence(time_window_minutes=15)

        assert "average_confidence" in result
        assert result["sample_size"] > 0
        # Con los datos mock, el promedio debería estar en rango excelente
        assert result["quality_status"] in ["EXCELLENT", "ACCEPTABLE"]

    @patch("kpi_monitor_handler.current_table")
    def test_get_average_detection_confidence_requires_investigation(self, mock_table):
        """Test: Average detection confidence - REQUIRES_INVESTIGATION (<75%)"""
        now = datetime.now(timezone.utc)
        low_confidence_data = [
            {
                "space_id": f"SPACE-{i:03d}",
                "confidence": Decimal("0.65"),  # Baja confianza
                "timestamp": now.isoformat(),
                "status": "occupied",
            }
            for i in range(5)
        ]
        mock_table.scan.return_value = {"Items": low_confidence_data}

        result = get_average_detection_confidence()

        assert result["average_confidence"] < 75
        assert result["quality_status"] == "REQUIRES_INVESTIGATION"

    @patch("kpi_monitor_handler.current_table")
    def test_get_low_confidence_event_rate_normal(
        self, mock_table, mock_current_table_data
    ):
        """Test: Low confidence event rate - NORMAL (<5%)"""
        mock_table.scan.return_value = {"Items": mock_current_table_data}

        result = get_low_confidence_event_rate(time_window_minutes=15, threshold=0.75)

        assert "low_confidence_rate" in result
        assert result["threshold"] == 75.0
        # Con los datos mock (1 de 5 es bajo), tasa = 20%
        assert result["low_confidence_count"] >= 1

    @patch("kpi_monitor_handler.current_table")
    def test_get_low_confidence_event_rate_action_required(self, mock_table):
        """Test: Low confidence rate - ACTION_REQUIRED (>10%)"""
        now = datetime.now(timezone.utc)
        # 50% de eventos con baja confianza
        mixed_data = [
            {
                "space_id": f"S{i}",
                "confidence": Decimal("0.65" if i % 2 == 0 else "0.95"),
                "timestamp": now.isoformat(),
            }
            for i in range(20)
        ]
        mock_table.scan.return_value = {"Items": mixed_data}

        result = get_low_confidence_event_rate()

        assert result["status"] == "ACTION_REQUIRED"
        assert result["low_confidence_rate"] > 10

    @patch("kpi_monitor_handler.current_table")
    def test_get_system_health_device_uptime_healthy(
        self, mock_table, mock_current_table_data
    ):
        """Test: System health - HEALTHY (≥90% uptime)"""
        mock_table.scan.return_value = {"Items": mock_current_table_data}

        result = get_system_health_device_uptime(inactive_threshold_minutes=5)

        assert "uptime_percentage" in result
        assert result["total_devices"] > 0
        assert result["status"] in ["HEALTHY", "DEGRADED"]

    @patch("kpi_monitor_handler.current_table")
    def test_get_system_health_device_uptime_degraded(self, mock_table):
        """Test: System health - DEGRADED (<90% uptime)"""
        now = datetime.now(timezone.utc)
        # Simular 50% de dispositivos inactivos
        degraded_data = [
            {
                "device_id": f"jetson-{i:03d}",
                "timestamp": (
                    now - timedelta(minutes=10 if i % 2 == 0 else 1)
                ).isoformat(),
            }
            for i in range(10)
        ]
        mock_table.scan.return_value = {"Items": degraded_data}

        result = get_system_health_device_uptime(inactive_threshold_minutes=5)

        assert result["uptime_percentage"] < 90
        assert result["status"] == "DEGRADED"
        assert len(result["inactive_devices"]) > 0

    # ========================================================================
    # TESTS - NIVEL 3: ANÁLISIS HISTÓRICO
    # ========================================================================

    @patch("kpi_monitor_handler.history_table")
    def test_calculate_average_parking_duration(
        self, mock_table, mock_history_table_data
    ):
        """Test: Calculate average parking duration from history"""
        mock_table.scan.return_value = {"Items": mock_history_table_data}

        result = calculate_average_parking_duration(days_back=7)

        assert "average_duration_hours" in result
        assert result["sample_size"] > 0
        assert result["usage_type"] in [
            "QUICK_ERRANDS",
            "RETAIL",
            "OFFICE_COMMUTERS",
            "AIRPORT_LONG_TERM",
        ]
        # Con datos mock de 2 horas, debería ser RETAIL
        assert result["usage_type"] == "RETAIL"

    @patch("kpi_monitor_handler.history_table")
    def test_calculate_average_parking_duration_no_data(self, mock_table):
        """Test: Parking duration calculation with no historical data"""
        mock_table.scan.return_value = {"Items": []}

        result = calculate_average_parking_duration()

        assert result["average_duration_hours"] == 0.0
        assert result["sample_size"] == 0
        assert result["usage_type"] == "NO_DATA"

    @patch("kpi_monitor_handler.history_table")
    def test_get_peak_occupancy_hours(self, mock_table, mock_history_table_data):
        """Test: Identify peak occupancy hours from historical data"""
        mock_table.scan.return_value = {"Items": mock_history_table_data}

        result = get_peak_occupancy_hours(days_back=30)

        assert "peak_hours" in result
        assert len(result["peak_hours"]) <= 5
        assert "hourly_breakdown" in result
        assert len(result["hourly_breakdown"]) == 24  # 24 horas del día

    @patch("kpi_monitor_handler.history_table")
    def test_get_occupancy_trend(self, mock_table, mock_history_table_data):
        """Test: Generate occupancy trend time series"""
        mock_table.scan.return_value = {"Items": mock_history_table_data}

        result = get_occupancy_trend(hours_back=24, interval_minutes=60)

        assert "trend_data" in result
        assert result["data_points"] > 0
        assert result["hours_analyzed"] == 24
        assert result["interval_minutes"] == 60

        # Verificar estructura de cada punto de datos
        for data_point in result["trend_data"]:
            assert "timestamp" in data_point
            assert "occupancy_rate" in data_point
            assert "occupied_count" in data_point

    # ========================================================================
    # TESTS - LAMBDA HANDLER
    # ========================================================================

    @patch("kpi_monitor_handler.get_current_occupancy_rate")
    def test_lambda_handler_specific_kpi(self, mock_occupancy):
        """Test: Lambda handler - request specific KPI"""
        mock_occupancy.return_value = {
            "occupancy_rate": 75.0,
            "total_spaces": 100,
            "occupied_spaces": 75,
            "status": "NORMAL",
        }

        event = {"kpi": "occupancy_rate"}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["kpi"] == "occupancy_rate"
        assert "data" in body
        assert body["data"]["occupancy_rate"] == 75.0

    @patch("kpi_monitor_handler.history_table")
    @patch("kpi_monitor_handler.current_table")
    @patch("kpi_monitor_handler.get_occupancy_trend")
    @patch("kpi_monitor_handler.get_peak_occupancy_hours")
    @patch("kpi_monitor_handler.calculate_average_parking_duration")
    @patch("kpi_monitor_handler.get_system_health_device_uptime")
    @patch("kpi_monitor_handler.get_low_confidence_event_rate")
    @patch("kpi_monitor_handler.get_average_detection_confidence")
    @patch("kpi_monitor_handler.check_critical_capacity_alert")
    @patch("kpi_monitor_handler.get_available_spaces_by_zone")
    @patch("kpi_monitor_handler.get_current_occupancy_rate")
    def test_lambda_handler_all_kpis(
        self,
        mock_get_current_occupancy_rate,
        mock_get_available_spaces_by_zone,
        mock_check_critical_capacity_alert,
        mock_get_average_detection_confidence,
        mock_get_low_confidence_event_rate,
        mock_get_system_health_device_uptime,
        mock_calculate_average_parking_duration,
        mock_get_peak_occupancy_hours,
        mock_get_occupancy_trend,
        mock_current_table,
        mock_history_table,
    ):
        """Test: Lambda handler - request all KPIs (dashboard mode)"""
        # Mock DynamoDB scans to prevent AWS calls
        mock_current_table.scan.return_value = {"Items": []}
        mock_history_table.scan.return_value = {"Items": []}

        # Mock all KPI functions return values
        mock_get_current_occupancy_rate.return_value = {"occupancy_rate": 50.0}
        mock_get_available_spaces_by_zone.return_value = {"total_vacant": 10}
        mock_check_critical_capacity_alert.return_value = {"alert_active": False}
        mock_get_average_detection_confidence.return_value = {
            "average_confidence": 90.0
        }
        mock_get_low_confidence_event_rate.return_value = {"low_confidence_rate": 0.0}
        mock_get_system_health_device_uptime.return_value = {"uptime_percentage": 100.0}
        mock_calculate_average_parking_duration.return_value = {
            "average_duration_hours": 1.5
        }
        mock_get_peak_occupancy_hours.return_value = {"peak_hours": []}
        mock_get_occupancy_trend.return_value = {"trend_data": []}

        event = {"kpi": "all"}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])

        # Verificar estructura de respuesta
        assert "level_1_operational" in body
        assert "level_2_performance" in body
        assert "level_3_analytics" in body
        assert "metadata" in body

        # Verificar que todos los KPIs están presentes
        assert "occupancy_rate" in body["level_1_operational"]
        assert "vacant_spaces" in body["level_1_operational"]
        assert "critical_capacity" in body["level_1_operational"]

        assert "detection_confidence" in body["level_2_performance"]
        assert "low_confidence_rate" in body["level_2_performance"]
        assert "system_health" in body["level_2_performance"]

        assert "parking_duration" in body["level_3_analytics"]
        assert "peak_hours" in body["level_3_analytics"]
        assert "occupancy_trend" in body["level_3_analytics"]

    def test_lambda_handler_invalid_kpi(self):
        """Test: Lambda handler - invalid KPI request"""
        event = {"kpi": "invalid_kpi_name"}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 400
        body = json.loads(result["body"])
        assert "error" in body
        assert "available_kpis" in body

    @patch("kpi_monitor_handler.get_current_occupancy_rate")
    def test_lambda_handler_with_custom_params(self, mock_occupancy):
        """Test: Lambda handler - KPI with custom parameters"""
        mock_occupancy.return_value = {"occupancy_rate": 80.0}

        event = {"kpi": "detection_confidence", "params": {"time_window_minutes": 30}}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert "params" in body["metadata"]
        assert body["metadata"]["params"]["time_window_minutes"] == 30

    @patch("kpi_monitor_handler.get_current_occupancy_rate")
    def test_lambda_handler_error_handling(self, mock_occupancy):
        """Test: Lambda handler - error handling"""
        mock_occupancy.side_effect = Exception("DynamoDB connection error")

        event = {"kpi": "occupancy_rate"}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 500
        body = json.loads(result["body"])
        assert "error" in body

    def test_lambda_handler_cors_headers(self):
        """Test: Lambda handler - CORS headers present"""
        event = {"kpi": "invalid"}  # Cualquier request

        result = lambda_handler(event, None)

        assert "headers" in result
        assert result["headers"]["Access-Control-Allow-Origin"] == "*"
        assert "Access-Control-Allow-Headers" in result["headers"]
        assert "Access-Control-Allow-Methods" in result["headers"]

    # ========================================================================
    # TESTS - EDGE CASES Y VALIDACIONES
    # ========================================================================

    @patch("kpi_monitor_handler.current_table")
    def test_handle_malformed_timestamps(self, mock_table):
        """Test: Handle malformed timestamp data gracefully"""
        now = datetime.now(timezone.utc)
        malformed_data = [
            {
                "space_id": "S1",
                "timestamp": "invalid-timestamp",
                "confidence": Decimal("0.9"),
                "status": "occupied",
            },
            {
                "space_id": "S2",
                "timestamp": now.isoformat(),
                "confidence": Decimal("0.95"),
                "status": "occupied",
            },
        ]
        mock_table.scan.return_value = {"Items": malformed_data}

        result = get_average_detection_confidence()

        # Debería ignorar el dato malformado y procesar el válido
        assert result["sample_size"] == 1

    @patch("kpi_monitor_handler.current_table")
    def test_handle_missing_fields(self, mock_table):
        """Test: Handle missing fields in DynamoDB items"""
        incomplete_data = [
            {"space_id": "S1", "status": "occupied"},  # Falta confidence
            {"space_id": "S2"},  # Falta status
        ]
        mock_table.scan.return_value = {"Items": incomplete_data}

        result = get_current_occupancy_rate()

        # Debería manejar datos incompletos sin error
        assert "occupancy_rate" in result

    @patch("kpi_monitor_handler.history_table")
    def test_parking_duration_incomplete_sessions(self, mock_table):
        """Test: Handle incomplete parking sessions (entry without exit)"""
        now = datetime.now(timezone.utc)
        incomplete_sessions = [
            {
                "space_id": "SPACE-001",
                "timestamp": (now - timedelta(hours=5)).isoformat(),
                "status": "occupied",
                "confidence": Decimal("0.92"),
                "device_id": "jetson-001",
            },
            # Falta el evento de salida (vacant)
        ]
        mock_table.scan.return_value = {"Items": incomplete_sessions}

        result = calculate_average_parking_duration()

        # No debería incluir sesiones incompletas en el cálculo
        assert result["sample_size"] == 0


# ============================================================================
# TESTS DE INTEGRACIÓN
# ============================================================================


class TestKPIIntegration:
    """Integration tests for KPI Lambda with realistic scenarios"""

    @patch("kpi_monitor_handler.current_table")
    @patch("kpi_monitor_handler.history_table")
    def test_full_dashboard_workflow(self, mock_history, mock_current):
        """Test: Complete dashboard workflow with all KPIs"""
        # Setup realistic data
        now = datetime.now(timezone.utc)

        current_data = [
            {
                "space_id": f"SPACE-{i:03d}",
                "status": "occupied" if i < 85 else "vacant",
                "confidence": Decimal("0.92"),
                "timestamp": now.isoformat(),
                "device_id": f"jetson-{i % 10:03d}",
                "zone_id": f"ZONE_{i % 3}",
                "facility_id": f"FACILITY_{i % 2}",
            }
            for i in range(100)
        ]

        mock_current.scan.return_value = {"Items": current_data}
        mock_history.scan.return_value = {"Items": []}

        event = {"kpi": "all"}
        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])

        # Validar métricas operacionales
        assert body["level_1_operational"]["occupancy_rate"]["occupancy_rate"] == 85.0
        assert body["level_1_operational"]["critical_capacity"]["alert_active"] is False

        # Validar métricas de rendimiento
        assert "detection_confidence" in body["level_2_performance"]
        assert "system_health" in body["level_2_performance"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
