import json
from unittest.mock import MagicMock, mock_open, patch
import argparse
import pytest

from edge_publisher import process_device_command

class TestEdgePublisherCommands:
    """Unit tests for the Edge Publisher command listener and screenshot generator"""

    @pytest.fixture
    def mock_args(self):
        """Mock argparse namespace for test parameters"""
        args = argparse.Namespace()
        args.video = None
        args.image = None
        return args

    @patch("edge_publisher.requests.put")
    def test_process_screenshot_yolo_success(self, mock_put, mock_args):
        """Test: Screenshot command captures frame from YOLO and uploads successfully"""
        mock_yolo = MagicMock()
        mock_yolo.get_current_frame.return_value = b"yolo-frame-bytes"
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        payload = json.dumps({
            "command": "screenshot",
            "upload_url": "https://s3.example.com/upload"
        })

        success = process_device_command(payload, mock_yolo, mock_args)

        assert success is True
        mock_yolo.get_current_frame.assert_called_once()
        mock_put.assert_called_once_with(
            "https://s3.example.com/upload",
            data=b"yolo-frame-bytes",
            headers={"Content-Type": "image/jpeg"},
            timeout=10
        )

    @patch("edge_publisher.requests.put")
    @patch("edge_publisher.capture_video_frame")
    def test_process_screenshot_video_fallback(self, mock_capture, mock_put, mock_args):
        """Test: Screenshot command falls back to capturing frame from video file if YOLO is disabled"""
        mock_args.video = "path/to/mock_video.mp4"
        mock_capture.return_value = b"video-frame-bytes"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        payload = json.dumps({
            "command": "screenshot",
            "upload_url": "https://s3.example.com/upload"
        })

        success = process_device_command(payload, None, mock_args)

        assert success is True
        mock_capture.assert_called_once_with("path/to/mock_video.mp4")
        mock_put.assert_called_once_with(
            "https://s3.example.com/upload",
            data=b"video-frame-bytes",
            headers={"Content-Type": "image/jpeg"},
            timeout=10
        )

    @patch("edge_publisher.requests.put")
    def test_process_screenshot_image_fallback(self, mock_put, mock_args):
        """Test: Screenshot command falls back to reading static mock image from file if YOLO and video are disabled"""
        mock_args.image = "mock_bus.jpg"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        payload = json.dumps({
            "command": "screenshot",
            "upload_url": "https://s3.example.com/upload"
        })

        # Mock the file read to avoid disk access
        with patch("builtins.open", mock_open(read_data=b"image-file-bytes")) as mock_file:
            success = process_device_command(payload, None, mock_args)

            assert success is True
            mock_file.assert_called_once_with("mock_bus.jpg", "rb")
            mock_put.assert_called_once_with(
                "https://s3.example.com/upload",
                data=b"image-file-bytes",
                headers={"Content-Type": "image/jpeg"},
                timeout=10
            )

    @patch("edge_publisher.requests.put")
    def test_process_screenshot_no_frame_available(self, mock_put, mock_args):
        """Test: Graceful warning return if no frame could be capturing across all methods"""
        payload = json.dumps({
            "command": "screenshot",
            "upload_url": "https://s3.example.com/upload"
        })

        success = process_device_command(payload, None, mock_args)

        assert success is False
        mock_put.assert_not_called()

    @patch("edge_publisher.requests.put")
    def test_process_screenshot_missing_url(self, mock_put, mock_args):
        """Test: Abort early if upload_url parameter is missing from command payload"""
        payload = json.dumps({
            "command": "screenshot"
        })

        success = process_device_command(payload, None, mock_args)

        assert success is False
        mock_put.assert_not_called()

    def test_process_reload_config_signal(self, mock_args):
        """Test: Reload config command returns the correct string instruction signal"""
        payload = json.dumps({
            "command": "reload_config"
        })

        res = process_device_command(payload, None, mock_args)
        assert res == "reload_config"
