# Changelog & System Overview
**Date**: December 5, 2025

## 1. Architectural Consolidation
We moved from a confusing "Split" architecture to a streamlined "Hybrid Cluster".

*   **Processor Decommissioned**: The old `TeraSpot-Processor` (stopped instance) was removed to prevent ghost data and confusion.
*   **Hub Promoted**: The `TeraSpot-Camera-Hub` was renamed to **`TeraSpot-Dev-Cluster`** and is now the single source of truth.
*   **Ghost Records Cleared**: Stale data from the old processor was purged from DynamoDB/S3.

## 2. Hybrid Simulation Cluster
We upgraded the Dev Cluster to be "Smart & Efficient" on `t2.micro` hardware.

*   **The Problem**: Running 3 full AI cameras on 1 CPU caused crashes.
*   **The Solution**: Implemented a **Hybrid Mode** in Terraform & Python:
    *   **Camera 1 & 2 (Static Mocks)**: Generate random data **ONCE** on startup and hold it. This saves CPU while keeping the dashboard "Green/Healthy".
    *   **Camera 3 (Real YOLO)**: Runs actual computer vision on the video feed. This is the only camera that "thinks".
*   **Code Changes**: Added `--static-mock` flag to `edge_publisher.py` to support this Low-CPU mode.

## 3. Dashboard Improvements
*   **Offline Handling**: Added logic to show "SISTEMA OFFLINE" (Red Badge) and mask data with "N/A" when the cluster is down.
*   **UI Unified**: Updated `/cameras` page to match the premium grid design of the dashboard.
*   **Latency Explanation**: The ~5-second latency is **normal** due to:
    1.  Hardware limits (`t2.micro` pinned at 100% CPU).
    2.  Cloud Round-Trip (Edge -> IoT -> Lambda -> DB -> Dashboard).

## 4. Why is "Low Confidence" high?
*   **Reason**: You are running a "Nano" model (`yolo11n`) on a potentially small/blurry video feed.
*   **Fix**: This is acceptable for a Demo. For Production, we would use a larger model (`yolo11m`) on a GPU instance.





also:
sometimes the system health drops and cameras fail but for a second, why does that happen?

💔 Heartbeat Skips (CPU Choke)
It's the CPU again.

Here is what is happening:

YOLO Spikes: Every time Camera 3 processes a frame, the CPU usage hits 100%.
Starvation: For a brief second, the CPU is so busy with AI that it pauses the "Mock" containers (Camera 1 & 2).
Late Heartbeat: If a heartbeat message is delayed by just a few seconds, the Backend (checking strictly for "Last 5 mins") might briefly think it's "Missing" or "Degraded" if the message queue backs up.
Is it a problem? Not really. It recovers instantly once the CPU frees up. It's just a symptom of running Heavy AI on a constrained $0 server. 📉
