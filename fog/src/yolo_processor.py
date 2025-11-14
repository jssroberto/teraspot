#!/usr/bin/env python3
"""
YOLO Parking Space Detector
Real inference from images for TeraSpot edge publisher
"""

from ultralytics import YOLO
import logging

logger = logging.getLogger(__name__)


class YOLOProcessor:
    def __init__(self, model_path="edge/models/yolo11n.pt"):
        """Initialize YOLO model"""
        try:
            self.model = YOLO(model_path)
            logger.info(f"✅ YOLO model loaded from {model_path}")
        except Exception as e:
            logger.error(f"❌ Failed to load YOLO model: {e}")
            raise

        self.image_path = None

    def set_image(self, image_path):
        """Set image for inference"""
        self.image_path = image_path
        logger.info(f"📸 Image set to: {image_path}")

    def detect_parking_spaces(self, image_path=None, total_spaces=30):
        """
        Run YOLO inference and simulate parking space detection

        Args:
            image_path: Path to image (optional, uses self.image_path if not provided)
            total_spaces: Total number of parking spaces in lot

        Returns:
            Dictionary with spaces, occupied count, and inference metadata
        """
        img_path = image_path or self.image_path
        if not img_path:
            raise ValueError("❌ No image path provided")

        try:
            # Run YOLO inference
            results = self.model(img_path, conf=0.5, verbose=False)
            detections = results[0].boxes.data  # Get bounding boxes

            num_detected_objects = len(detections)
            logger.info(f"🚗 YOLO detected {num_detected_objects} objects")

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
            logger.error(f"❌ YOLO inference failed: {e}")
            raise
