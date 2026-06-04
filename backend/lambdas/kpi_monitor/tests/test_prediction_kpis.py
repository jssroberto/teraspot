from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from kpi_monitor_handler import predict_future_occupancy


class TestKPIPredictions:
    """Unit tests specifically covering KPI Occupancy Predictions (Linear Regression)"""

    @patch("kpi_monitor_handler.get_occupancy_trend")
    def test_predict_future_occupancy_normal_trend(self, mock_trend):
        """Test: Predict future occupancy under normal linear trend conditions"""
        # Mock trend data showing a linear increase
        now = datetime.now(timezone.utc)
        trend_data = []
        for i in range(10):
            slot_time = now - timedelta(hours=9 - i)
            trend_data.append({
                'timestamp': slot_time.isoformat(),
                'occupancy_rate': 10.0 + (i * 5.0),  # 10% to 55%
                'occupied_count': 1,
                'sample_size': 10
            })

        mock_trend.return_value = {
            'trend_data': trend_data,
            'hours_analyzed': 10,
            'interval_minutes': 60,
            'data_points': len(trend_data),
            'timestamp': now.isoformat()
        }

        result = predict_future_occupancy(hours_back=10, prediction_horizon_hours=3)

        assert 'error' not in result
        assert result['slope'] > 0.0
        assert result['trend_direction'] == 'INCREASING'
        assert len(result['predictions']) == 3
        # First prediction should be higher than the last trend data point (55.0)
        assert result['predictions'][0]['predicted_occupancy'] > 55.0

    @patch("kpi_monitor_handler.get_occupancy_trend")
    def test_predict_future_occupancy_zero_division(self, mock_trend):
        """Test: Predict future occupancy with zero time variance (identical timestamps)"""
        now = datetime.now(timezone.utc)
        # All points have the exact same timestamp
        trend_data = [
            {
                'timestamp': now.isoformat(),
                'occupancy_rate': 40.0,
                'occupied_count': 4,
                'sample_size': 10
            },
            {
                'timestamp': now.isoformat(),
                'occupancy_rate': 40.0,
                'occupied_count': 4,
                'sample_size': 10
            }
        ]

        mock_trend.return_value = {
            'trend_data': trend_data,
            'hours_analyzed': 10,
            'interval_minutes': 60,
            'data_points': len(trend_data),
            'timestamp': now.isoformat()
        }

        # Should not raise ZeroDivisionError and safely return flat slope
        result = predict_future_occupancy(hours_back=10, prediction_horizon_hours=5)

        assert 'error' not in result
        assert result['slope'] == 0.0
        assert result['intercept'] == 40.0
        assert result['trend_direction'] == 'STABLE'
        assert len(result['predictions']) == 5
        for pred in result['predictions']:
            assert pred['predicted_occupancy'] == 40.0

    @patch("kpi_monitor_handler.get_occupancy_trend")
    def test_predict_future_occupancy_clamping(self, mock_trend):
        """Test: Verify prediction clamping between 0 and 100%"""
        now = datetime.now(timezone.utc)
        # Fast increasing trend that would mathematically exceed 100%
        trend_data = []
        for i in range(10):
            slot_time = now - timedelta(hours=9 - i)
            trend_data.append({
                'timestamp': slot_time.isoformat(),
                'occupancy_rate': 80.0 + (i * 3.0),  # 80% to 107%
                'occupied_count': 8,
                'sample_size': 10
            })

        mock_trend.return_value = {
            'trend_data': trend_data,
            'hours_analyzed': 10,
            'interval_minutes': 60,
            'data_points': len(trend_data),
            'timestamp': now.isoformat()
        }

        result = predict_future_occupancy(hours_back=10, prediction_horizon_hours=5)

        assert 'error' not in result
        for pred in result['predictions']:
            # Predictions should be clamped to a maximum of 100%
            assert pred['predicted_occupancy'] <= 100.0
            assert pred['predicted_occupancy'] >= 0.0

    @patch("kpi_monitor_handler.get_occupancy_trend")
    def test_predict_future_occupancy_insufficient_data(self, mock_trend):
        """Test: Return error payload when insufficient data points are available"""
        mock_trend.return_value = {
            'trend_data': [],
            'hours_analyzed': 10,
            'interval_minutes': 60,
            'data_points': 0,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

        result = predict_future_occupancy(hours_back=10, prediction_horizon_hours=5)

        assert 'error' in result
        assert result['error'] == 'Insufficient data for prediction'

    @patch("kpi_monitor_handler.get_occupancy_trend")
    def test_predict_future_occupancy_exception_handling(self, mock_trend):
        """Test: Graceful error response on unexpected internal exceptions"""
        mock_trend.side_effect = Exception("Mocked database scanning error")

        result = predict_future_occupancy(hours_back=10, prediction_horizon_hours=5)

        assert 'error' in result
        assert 'Mocked database scanning error' in result['error']
