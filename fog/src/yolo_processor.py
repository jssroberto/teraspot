#!/usr/bin/env python3
"""
YOLO Parking Space Detector
Supports image or video inference for the TeraSpot edge publisher
"""

from ultralytics import YOLO
import logging
import cv2

logger = logging.getLogger(__name__)


class YOLOProcessor:
    def __init__(self, model_path="models/yolo11n.pt", frame_skip=0):
        """Initialize YOLO model"""
        try:
            self.model = YOLO(model_path)
            logger.info(f"YOLO model loaded from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise

        self.image_path = None
        self.video_path = None
        self.cap = None
        self.source_type = "image"
        self.frame_skip = max(frame_skip, 0)

    def set_image(self, image_path):
        """Set image for inference"""
        self.cleanup()
        self.image_path = image_path
        self.source_type = "image"
        logger.info(f"Image set to: {image_path}")

    def set_video(self, video_path):
        """Set video source for inference"""
        self.cleanup()
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to open video source: {video_path}")

        self.cap = cap
        self.video_path = video_path
        self.source_type = "video"
        logger.info(f"Video source set to: {video_path}")

    def cleanup(self):
        """Release any open capture resources"""
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    def _read_video_frame(self):
        """Read the next frame from the configured capture"""
        if self.cap is None:
            raise ValueError("Video source not initialized")

        # Optionally skip frames to reduce inference cost
        for _ in range(self.frame_skip + 1):
            ret, frame = self.cap.read()
            if not ret:
                # Restart the capture from the beginning to loop the video
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self.cap.read()
                if not ret:
                    raise RuntimeError("Failed to read frame from video source")
        return frame

    def detect_parking_spaces(self, image_path=None, total_spaces=30):
        """
        Run YOLO inference and simulate parking space detection

        Args:
            image_path: Path to image (optional, uses self.image_path if not provided)
            total_spaces: Total number of parking spaces in lot

        Returns:
            Dictionary with spaces, occupied count, and inference metadata
        """
        if self.source_type == "video":
            frame = self._read_video_frame()
            inference_source = frame
        else:
            img_path = image_path or self.image_path
            if not img_path:
                raise ValueError("No image path provided")
            inference_source = img_path

        try:
            # Run YOLO inference
            results = self.model(inference_source, conf=0.5, verbose=False)
            detections = results[0].boxes.data  # Get bounding boxes

            num_detected_objects = len(detections)
            logger.info(f"YOLO detected {num_detected_objects} objects")

            # Simulate parking detection: assume 70% of detections are vehicles
            vehicle_count = int(num_detected_objects * 0.7)
            occupied_count = min(vehicle_count, total_spaces)  # Cap at total spaces
            vacant_count = total_spaces - occupied_count

            # Generate space-by-space status
            spaces = {}
            for i in range(1, total_spaces + 1):
                space_id = f"A-{i:02d}"
                is_occupied = i <= occupied_count
                spaces[space_id] = {
                    "status": "occupied" if is_occupied else "vacant",
                    "confidence": 0.92 + (i * 0.001) % 0.08,
                }

            return {
                "spaces": spaces,
                "total_occupied": occupied_count,
                "total_vacant": vacant_count,
                "detections_count": num_detected_objects,
                "vehicle_count": vehicle_count,
            }

        except Exception as e:
            logger.error(f"YOLO inference failed: {e}")
            raise
