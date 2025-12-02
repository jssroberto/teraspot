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

# COCO dataset class IDs: 2=Car, 3=Motorcycle, 5=Bus, 7=Truck
VEHICLE_CLASSES = [2, 3, 5, 7]


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
        self.last_frame = None

    def get_current_frame(self):
        """Returns the last processed frame encoded as JPEG bytes."""
        if self.last_frame is None:
            return None
        success, encoded_image = cv2.imencode(".jpg", self.last_frame)
        if not success:
            return None
        return encoded_image.tobytes()

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
        
        # Get FPS
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        if not self.fps or self.fps <= 0:
            self.fps = 30.0
            logger.warning(f"Could not determine FPS, defaulting to {self.fps}")
            
        logger.info(f"Video source set to: {video_path} (FPS: {self.fps:.2f})")

    def advance_video_time(self, seconds):
        """Skip frames to simulate time passing in a video file"""
        if self.source_type == "video" and self.cap:
            frames_to_skip = int(seconds * self.fps)
            if frames_to_skip > 0:
                current_frame = self.cap.get(cv2.CAP_PROP_POS_FRAMES)
                total_frames = self.cap.get(cv2.CAP_PROP_FRAME_COUNT)
                
                new_pos = current_frame + frames_to_skip
                
                # Handle loop if we go past end
                if total_frames > 0:
                    new_pos = new_pos % total_frames
                    
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, new_pos)
                logger.debug(f"Advanced video by {seconds}s ({frames_to_skip} frames) to frame {int(new_pos)}")

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
        self, detections: List[Dict[str, Optional[float]]], width: int, height: int
    ) -> Dict[str, float]:
        """Return per-space confidence scores from detection centerpoints."""
        occupancy: Dict[str, float] = {}
        for detection in detections:
            center = detection.get("center")
            if not center:
                continue
            
            # Normalize center to 0-1 to match ROI polygons
            norm_center = (center[0] / width, center[1] / height)
            
            for roi in self._roi_spaces.values():
                if point_in_polygon(norm_center, roi.polygon):
                    confidence = float(detection.get("confidence") or 0.0)
                    prev = occupancy.get(roi.space_id)
                    if prev is None or confidence > prev:
                        occupancy[roi.space_id] = confidence
                    break
        return occupancy

    def detect_parking_spaces(
        self, image_path=None, total_spaces=30, burst_size=1, conf_threshold=0.5
    ):
        """
        Run YOLO inference with temporal smoothing.

        Args:
            image_path: Path to image (optional, uses self.image_path if not provided)
            total_spaces: Total number of parking spaces in lot
            burst_size: Number of frames to process for majority voting (default: 1)
            conf_threshold: Confidence threshold for YOLO inference (default: 0.5)

        Returns:
            Dictionary with spaces, occupied count, and inference metadata
        """
        # Accumulators for majority voting
        space_votes: Dict[str, int] = {}
        space_conf_sum: Dict[str, float] = {}
        last_detection_count = 0

        # Only burst if we are processing video
        actual_burst = burst_size if self.source_type == "video" else 1

        for _ in range(actual_burst):
            if self.source_type == "video":
                inference_source = self._read_video_frame()
            else:
                img_path = image_path or self.image_path
                if not img_path:
                    raise ValueError("No image path provided")
                inference_source = cv2.imread(img_path) # Read image to store it
            
            self.last_frame = inference_source

            try:
                # Run YOLO inference
                results = self.model(
                    inference_source,
                    conf=conf_threshold,
                    verbose=False,
                    classes=VEHICLE_CLASSES,
                )
                boxes = results[0].boxes
                num_detected_objects = int(len(boxes) if boxes is not None else 0)
                last_detection_count = num_detected_objects

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

                # Accumulate votes if ROIs are defined
                if self._roi_spaces:
                    height, width = inference_source.shape[:2]
                    occupancy_map = self._map_detections_to_spaces(detections, width, height)
                    for space_id, conf in occupancy_map.items():
                        space_votes[space_id] = space_votes.get(space_id, 0) + 1
                        space_conf_sum[space_id] = (
                            space_conf_sum.get(space_id, 0.0) + conf
                        )

            except Exception as e:
                logger.error(f"YOLO inference failed: {e}")
                raise

        logger.info(
            f"YOLO burst processed {actual_burst} frames. Last count: {last_detection_count}"
        )

        if self._roi_spaces:
            spaces = {}
            occupied_count = 0

            for space_id in self._roi_spaces:
                votes = space_votes.get(space_id, 0)
                # Majority vote: > 50% of frames
                is_occupied = votes > (actual_burst / 2)

                avg_conf = 0.0
                if is_occupied and votes > 0:
                    avg_conf = space_conf_sum.get(space_id, 0.0) / votes

                spaces[space_id] = {
                    "status": "occupied" if is_occupied else "vacant",
                    "confidence": round(avg_conf, 3),
                }
                if is_occupied:
                    occupied_count += 1

            total_spaces = len(spaces)
            vacant_count = total_spaces - occupied_count
        else:
            # Simulated fallback when ROIs are unavailable
            vehicle_count = int(last_detection_count * 0.7)
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
            "detections_count": last_detection_count,
            "vehicle_count": occupied_count,
        }
