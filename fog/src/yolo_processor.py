#!/usr/bin/env python3
"""
YOLO Parking Space Detector
Supports image or video inference for the TeraSpot edge publisher
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
from ultralytics import YOLO


Point = Tuple[float, float]


def point_in_polygon(point: Point, polygon: Sequence[Point]) -> bool:
    """Return True when a point lies inside (or on edge of) a polygon."""
    x, y = point
    inside = False
    n = len(polygon)
    if n < 3:
        return False

    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        intersects = ((y1 > y) != (y2 > y)) and (
            x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1
        )
        if intersects:
            inside = not inside
    return inside


@dataclass
class ParkingSpaceROI:
    space_id: str
    polygon: List[Point]

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
        self._roi_spaces: Dict[str, ParkingSpaceROI] = {}

    def set_roi_spaces(self, spaces_config: List[Dict[str, object]]):
        """Validate and store ROI polygons for parking spaces."""
        if not spaces_config:
            raise ValueError("ROI configuration must include at least one space")

        processed: Dict[str, ParkingSpaceROI] = {}
        for entry in spaces_config:
            space_id = entry.get("space_id") if isinstance(entry, dict) else None
            polygon = entry.get("polygon") if isinstance(entry, dict) else None
            if not space_id or not isinstance(space_id, str):
                raise ValueError("ROI space entries require a string 'space_id'")
            if not polygon or not isinstance(polygon, list) or len(polygon) < 3:
                raise ValueError(
                    f"Space {space_id} must define a polygon with >= 3 coordinate pairs"
                )

            normalized: List[Point] = []
            for point in polygon:
                if not isinstance(point, (list, tuple)) or len(point) != 2:
                    raise ValueError(
                        f"Polygon for {space_id} must be [[x, y], ...] coordinates"
                    )
                x, y = point
                normalized.append((float(x), float(y)))

            processed[space_id] = ParkingSpaceROI(space_id=space_id, polygon=normalized)

        self._roi_spaces = processed
        logger.info("Loaded %d ROI parking spaces", len(self._roi_spaces))

    def has_roi_spaces(self) -> bool:
        return bool(self._roi_spaces)

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

    def _map_detections_to_spaces(
        self, detections: List[Dict[str, Optional[float]]]
    ) -> Dict[str, float]:
        """Return per-space confidence scores from detection centerpoints."""
        occupancy: Dict[str, float] = {}
        for detection in detections:
            center = detection.get("center")
            if not center:
                continue
            for roi in self._roi_spaces.values():
                if point_in_polygon(center, roi.polygon):
                    confidence = float(detection.get("confidence") or 0.0)
                    prev = occupancy.get(roi.space_id)
                    if prev is None or confidence > prev:
                        occupancy[roi.space_id] = confidence
                    break
        return occupancy

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
            boxes = results[0].boxes
            num_detected_objects = int(len(boxes) if boxes is not None else 0)

            detections: List[Dict[str, Optional[float]]] = []
            if boxes is not None and num_detected_objects:
                xyxy = boxes.xyxy.tolist()
                confidences = (
                    boxes.conf.tolist()
                    if boxes.conf is not None
                    else [None] * len(xyxy)
                )
                for coords, conf in zip(xyxy, confidences):
                    x1, y1, x2, y2 = [float(c) for c in coords]
                    center = ((x1 + x2) / 2.0, (y1 + y2) / 2.0)
                    detections.append(
                        {
                            "bbox": (x1, y1, x2, y2),
                            "center": center,
                            "confidence": float(conf) if conf is not None else None,
                        }
                    )

            logger.info(f"YOLO detected {num_detected_objects} objects")

            if self._roi_spaces:
                occupancy_map = self._map_detections_to_spaces(detections)
                spaces = {}
                for space_id, roi in self._roi_spaces.items():
                    confidence = occupancy_map.get(space_id)
                    spaces[space_id] = {
                        "status": "occupied" if confidence is not None else "vacant",
                        "confidence": round(confidence, 3) if confidence else 0.0,
                    }

                occupied_count = len(occupancy_map)
                total_spaces = len(spaces)
                vacant_count = total_spaces - occupied_count
            else:
                # Simulated fallback when ROIs are unavailable
                vehicle_count = int(num_detected_objects * 0.7)
                occupied_count = min(vehicle_count, total_spaces)
                vacant_count = total_spaces - occupied_count

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
                "vehicle_count": occupied_count,
            }

        except Exception as e:
            logger.error(f"YOLO inference failed: {e}")
            raise
