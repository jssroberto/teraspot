# Fog Computing (Edge) Documentation

## Overview
The **Fog** component is the edge computing layer of TeraSpot. It runs on-premise (e.g., on a NVIDIA Jetson or an EC2 Instance simulating a camera gateway) close to the video source.

**Mission**: Process raw high-bandwidth video streams locally and transmit only low-bandwidth, high-value metadata (occupancy status) to the cloud.

## Key Features
*   **Computer Vision**: Uses **YOLO11** (You Only Look Once) for real-time object detection.
*   **Privacy First**: No video leaves the premise. Only "Occupied/Vacant" signals are sent.
*   **Resilience**: Buffers data if the internet connection is lost.
*   **Remote Configuration**: Fetches ROI (Region of Interest) definitions from the cloud, allowing admins to redraw parking spots without physical access to the device.

## Directory Structure (`fog/`)

| Directory | Description |
| :--- | :--- |
| **`src/`** | Python source code for the computer vision engine and MQTT publisher. |
| **`models/`** | Stores the YOLO model weights (e.g., `yolo11n.pt`). |
| **`config/`** | Default configuration files. |
| **`assets/`** | Test images and videos for development/simulation. |
| **`Dockerfile`** | Definition for the containerized deployment environment. |

## Detailed Documentation
*   **[Core Logic](./fog.LOGIC.md)**: Deep dive into how `yolo_processor.py` tracks vehicles and reduces noise.
*   **[Deployment & Hardware](./fog.DEPLOYMENT.md)**: Hardware requirements, Docker setup, and environment variables.
