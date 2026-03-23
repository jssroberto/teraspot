# 🚗 TeraSpot

**TeraSpot** is a real-time, AI-powered smart parking solution that leverages edge computing for computer vision and a serverless cloud architecture for massive scalability. It provides instant parking availability updates to drivers while offering powerful analytics and zone management tools for administrators.

---

## 🌟 Key Features

*   **Real-Time Occupancy Detection**: Processing video feeds locally at the edge using YOLOv11 to determine empty vs. occupied parking spots in milliseconds.
*   **Serverless & Event-Driven**: Cloud infrastructure built entirely on AWS Serverless (Lambda, DynamoDB, IoT Core), ensuring zero idle costs and infinite scalability.
*   **Instant Client Updates**: Live feedback pushed directly to mobile apps and dashboards via WebSockets powered by DynamoDB Streams.
*   **Dynamic Configuration**: Adjust Regions of Interest (ROIs)—the polygons defining parking spots—remotely via a web dashboard without touching the edge cameras.
*   **Cross-Platform Client Apps**: A unified monorepo for iOS, Android, and Web using Expo and React Native for both end-users and parking managers.

---

## 🏗️ High-Level Architecture

TeraSpot is divided into three primary operational layers, tightly coupled by a robust data pipeline:

### 1. The Edge (Fog Computing)
Located in `fog/`, this layer turns raw video feeds into actionable structured data.
*   **Device**: Runs on physical Edge nodes (or simulated in EC2/Docker).
*   **AI Engine**: **YOLOv11** object detection identifies vehicles (cars, motorcycles, trucks, buses).
*   **Spatial Logic**: Uses Ray Casting to check if detected vehicle centers fall within predefined parking space polygons.
*   **Communication**: Publishes occupancy data to AWS IoT Core over MQTT.

### 2. The Cloud (Serverless Backend)
Located in `backend/`, this acts as the central nervous system.
*   **Ingestion**: `ingest_status` Lambda updates the current state in DynamoDB.
*   **Broadcast**: Changes trigger the `analytics_notifier` via DynamoDB Streams to push WebSocket updates to connected clients.
*   **API & Control**: REST APIs serve the current snapshot, calculate KPIs, and manage remote camera configurations (saving JSON templates to S3).
*   **Alerting**: Automated health checks alert via SQS/SNS if cameras go offline or parking lots reach critical capacity.

### 3. The Client (Frontend Applications)
Located in `frontend/`, this is the user-facing interface, built as an Expo Monorepo.
*   **Client App (`apps/client`)**: Allows drivers to find available spaces in real-time.
*   **Admin App (`apps/admin`)**: Provides management dashboards, KPI charts, and the visual ROI configuration tool.
*   **Packages**: Shared UI components and core business logic ensure consistency across the ecosystem.

---

## 📂 Repository Structure

The repository is modular and organized into independent yet cohesive workspaces:

```text
teraspot/
├── backend/            # AWS Lambda Functions & API Gateway logic (Python)
├── fog/                # Edge Computing & Computer Vision pipeline (Python/YOLO)
├── frontend/           # Mobile and Web Applications (TypeScript/Expo)
├── infrastructure/     # Infrastructure as Code resources (Terraform/AWS)
├── docs/               # In-depth technical documentation & architecture maps
└── github-workflows/   # CI/CD pipelines (GitHub Actions)
```

---

## 🔄 Core Data Flow

1.  **Vehicle Parks**: Camera spots a vehicle.
2.  **Edge Processing**: Fog node runs YOLO, detects a "car" inside "Spot A".
3.  **Publish MQTT**: Fog publishes `{ "spot_A": "occupied" }` to **AWS IoT Core**.
4.  **Database Update**: The `ingest_status` Lambda function validates the message and updates **DynamoDB**.
5.  **Event Triggered**: `analytics_notifier` Lambda is triggered by the **DynamoDB Stream**.
6.  **Broadcast**: Backend pushes a WebSocket message with the state change.
7.  **UI Update**: The React Native application receives the payload and turns Spot A's indicator red.

---

## 🚀 Deployment & Infrastructure

All resources are provisioned via **Terraform** to ensure environments are fully reproducible.

*   **Compute**: AWS Lambda, EC2 (for camera simulation)
*   **Storage**: DynamoDB (Hot State), Timestream (History), S3 (Configs/Uploads)
*   **Networking**: Amazon API Gateway, AWS IoT Core
*   **CI/CD**: Fully automated test and deployment pipelines using GitHub Actions.

For detailed deployment instructions, navigate to `infrastructure/README.md`.

---

## 📚 Documentation

Dive deeper into specific parts of the system:
- [System Architecture](docs/ARCHITECTURE.md)
- [System Interactions & Data Flow](docs/INTERACTIONS.md)
- [Backend API Reference](docs/API.md)
- [Edge Logic Overview](docs/fog/fog.LOGIC.md)
- [Frontend Overview](docs/frontend/frontend.APPS.md)

---

## 🛡️ License & Contributing

Distributed under the MIT License. See `LICENSE` for more information.
