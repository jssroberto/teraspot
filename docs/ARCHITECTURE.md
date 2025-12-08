# TeraSpot System Architecture

## 1. Executive Summary
TeraSpot is a real-time smart parking solution that leverages edge computing for computer vision and a serverless cloud architecture for scalability. The system processes video feeds locally (Fog Layer) to detect vehicle occupancy and transmits metadata to the cloud (Backend Layer), which then powers real-time updates for mobile and web clients (Frontend Layer).

## 2. High-Level Architecture
The system follows a three-tier architecture:
1.  **Fog Computing (Edge)**: Local video processing and object detection.
2.  **Serverless Backend (Cloud)**: Event-driven logic, data storage, and analytics.
3.  **Frontend Clients (App/Web)**: User interfaces for drivers and administrators.

### Core Data Flow
1.  **Ingestion**: Cameras -> Edge Device (YOLO AI) -> MQTT Message -> AWS IoT Core.
2.  **Processing**: IoT Core -> Lambda Ingest -> DynamoDB Update.
3.  **Distribution**: DynamoDB Stream -> Lambda Analytics -> WebSocket Push -> Client App.

---

## 3. Module Breakdown

### 3.1. Fog Computing (The Edge)
Located in the `fog/` directory.
This module runs on-premise (simulated on EC2) and is responsible for turning raw video into data.

*   **Core Logic (`fog/src`)**:
    *   **YOLO Processor (`yolo_processor.py`)**: Uses the YOLO11 architecture (PyTorch) to detect vehicles in defined Regions of Interest (ROIs).
    *   **Edge Publisher (`edge_publisher.py`)**: Formats detection data and publishes it to AWS IoT Core via MQTT.
    *   **Config Utils**: Fetches ROI configurations (`config.json`) from S3 at startup.
*   **Infrastructure**: Dockerized Application running on Linux (Jetson/EC2 GPU).

### 3.2. Serverless Backend (The Cloud)
Located in the `backend/` directory.
A pure serverless architecture using AWS Lambda and API Gateway, maximizing scalability and minimizing idle costs.

#### Key Lambda Functions:
| Function Name | Responsibility | Trigger |
| :--- | :--- | :--- |
| **Ingest Status** (`ingest_status`) | Direct entry point from Edge. Validates payload and updates `DynamoDB` with current parking space status. | AWS IoT Rule (MQTT) |
| **Read Status** (`read_status`) | Serves the current state of all parking spaces to the frontend via REST API. | API Gateway (GET) |
| **Config Saver** (`config_saver`) | Admin tool to save new ROI configurations to S3, which Edge devices then pick up. | API Gateway (POST) |
| **KPI Monitor** (`kpi_monitor`) | The "Intelligence Engine". Aggregates data to calculate metrics like Occupancy Rate, System Health, and Peak Hours. | API Gateway (POST) |
| **Analytics & Notifier** (`analytics_notifier`) | Reacts to state changes. 1. Pushes updates to frontend via WebSockets. 2. Archives data to Timestream. 3. Sends alerts via SNS. | DynamoDB Stream |

#### Data Stores:
*   **DynamoDB**: Stores the *current* state of every parking space (Real-time hot storage).
*   **Amazon Timestream**: Stores historical occupancy data for analytics (Time-series storage).
*   **S3**: Stores static website assets and ROI configuration files (`config.json`).

### 3.3. Frontend Applications (The Client)
Located in the `frontend/` directory.
A monorepo using **Expo (React Native)** + **Expo Router**, enabling a unified codebase for iOS, Android, and Web.

*   **Structure**:
    *   **`apps/client`**: Consumer-facing app. Drivers use this to find available parking spots in real-time.
    *   **`apps/admin`**: Management dashboard. Admins use this to view KPIs, system health, and configure camera ROIs.
    *   **`packages/ui`**: Shared UI component library to ensure design consistency.
    *   **`packages/core`**: Shared business logic and utilities.

*   **Technologies**:
    *   **Framework**: Expo (React Native)
    *   **Routing**: Expo Router (File-based routing)
    *   **State**: React Query / Context
    *   **Platform**: Web (React Native Web) + Mobile (Native)

### 3.4. Infrastructure (DevOps)
Located in the `infrastructure/` directory.
All AWS resources are provisioned as code (IaC) to ensure reproducibility.

*   **Terraform**: Manages the complete lifecycle of AWS resources (Lambda, API Gateway, DynamoDB, IoT Core, Policies).
*   **GitHub Actions**: CI/CD pipelines for testing backend code and deploying infrastructure changes.

## 4. Key Workflows

### W1: Real-Time Update Loop
1.  **Detection**: Edge device sees a car enter Spot #5.
2.  **Publish**: Edge publishes MQTT message `{ "spot_id": 5, "status": "occupied" }`.
3.  **Ingest**: AWS IoT triggers `ingest_status` Lambda -> Updates DynamoDB.
4.  **Broadcast**: DynamoDB Stream triggers `analytics_notifier` -> Pushes WebSocket message to all connected clients.
5.  **View**: Client App receives message and turns Spot #5 red instantly.

### W2: Configuration Update
1.  **Draw**: Admin draws a new box on the camera feed in `apps/admin`.
2.  **Save**: App calls `config_saver` API.
3.  **Store**: Lambda saves new JSON to S3.
4.  **Sync**: Edge device restarts or polls, downloads new JSON, and updates detection zones.

## 5. Directory Structure Map
```text
/
├── backend/            # AWS Lambda Functions (Python)
│   ├── lambdas/
│   │   ├── ingest_status/
│   │   ├── kpi_monitor/
│   │   └── ...
│   └── shared/         # Shared Python libraries
├── fog/                # Edge Computing Code (Python/YOLO)
│   ├── src/            # Detection logic
│   └── models/         # YOLO weights
├── frontend/           # Expo Monorepo (TypeScript)
│   ├── apps/
│   │   ├── admin/      # Management Dashboard
│   │   └── client/     # User App
│   └── packages/       # Shared UI/Core
└── infrastructure/     # Terraform & CloudFormation
```

## 6. System Interactions
For a detailed mapping of dependencies, signal flows, and deployment links between these modules, see the **[System Interactions & Dependencies](./INTERACTIONS.md)** document.

