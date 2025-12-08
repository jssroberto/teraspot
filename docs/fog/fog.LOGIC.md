# Edge Logic & Computer Vision

The core intelligence of the Fog node is contained in `src/`. This document explains how raw pixels are converted into actionable data.

## 1. Object Detection (`yolo_processor.py`)
We use **Ultralytics YOLO** (v11n) for object detection.

*   **Classes**: The model is configured to detect only relevant vehicles from the COCO dataset:
    *   2: Car
    *   3: Motorcycle
    *   5: Bus
    *   7: Truck
*   **Burst Processing**: To save compute and battery, the system does not run inference on every single frame. Instead, it processes a "burst" of frames (e.g., 5 frames) and then sleeps for an interval (e.g., 5 seconds).

## 2. Spatial Mapping (Polygon Logic)
Raw detections are simple Bounding Boxes (Rectangles). However, parking spots are rarely perfect rectangles aligned with the camera.

1.  **Configuration**: We defined `ParkingSpaceROI` objects, which are arbitrary polygons (list of x,y points) enveloping a specific parking spot.
2.  **Mapping**:
    *   For every detected vehicle, we calculate its **Center Point**.
    *   We use the **Ray Casting Algorithm** (`point_in_polygon`) to check if that center point falls inside any of the defined ROIs.
    *   If `Center(Vehicle) ∈ Polygon(Spot A)`, then Spot A is occupied.

## 3. Noise Reduction (Majority Voting)
Computer vision can be jittery. A shadow or a passing person might trigger a false positive for a millisecond. To prevent "flickering" state:
*   We run inference on `N` frames (Burst Size).
*   For each spot, we count how many frames it was detected as occupied.
*   **Threshold**: Determining status requires > 50% positive votes within the burst.
    *   *Example*: In a 5-frame burst, if a car is seen in 3 frames, the spot is "Occupied". If seen in only 2, it is "Vacant".

## 4. Configuration Management (`config_utils.py`)
The device needs to know *where* the parking spots are.
It attempts to load this configuration in the following order:
1.  **API Gateway**: Calls the cloud API (`/config`) to get the latest dynamic config.
2.  **S3 Bucket**: Downloads a specific JSON file.
3.  **Local File**: Fallback for offline/testing mode.

This allows administrators to update the ROI zones in the web dashboard, and the edge devices will automatically pick up the new definitions on the next restart or config reload command.
