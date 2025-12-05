# Alerts & Analytics Guide

## Overview
This document explains the new **Alert Configuration** and **Analytics Dashboard** features in the TeraSpot Admin Console.

## 1. Accessing the New Features
*   **Web/Desktop**: Look for **"Alerts"** and **"Analytics"** in the left Sidebar.
*   **Mobile**: Look for the **Bell Icon** (Alerts) and **Pie Chart Icon** (Analytics) in the bottom tab bar.
*   *Note: If you don't see these options, please reload the application.*

## 2. Configuring Alerts
Admins can now dynamically configure system thresholds without redeploying code.

1.  Navigate to the **Alerts** tab.
2.  **Thresholds**:
    *   **Critical Occupancy (%)**: Triggers a CRITICAL alert (Red). *Default: 95%*.
    *   **Warning Occupancy (%)**: Triggers a WARNING alert (Orange). *Default: 80%*.
    *   **Confidence Threshold**: Min confidence (0.0-1.0) to accept AI detections. *Default: 0.8*.
    *   **Inactive Timeout**: Minutes before a camera is marked "Dead". *Default: 5*.
3.  **Notifications**:
    *   **Email (SNS)**: Toggle email alerts on/off.
    *   **App Notifications**: Toggle in-app dashboard toasts.
4.  Tap **Save Configuration** to apply changes immediately.

## 3. Analytics & Inference
Visualizes historical data and predicts future trends using Linear Regression.

1.  Navigate to the **Analytics** tab.
2.  **Controls**:
    *   **Prediction Horizon**: Enter the number of hours to predict (e.g., `24`, `48`).
    *   **Period Selector**: Choose `24H`, `7D`, or `30D` of historical context.
3.  **Charts**:
    *   **Occupancy Trend**: Solid line = History. Yellow dots = Future Prediction.
    *   **Peak Hours**: Bar chart showing the busiest hours of the day based on the selected period.

## 4. Dashboard Updates
The main **Dashboard** now includes:
*   **System Health**: "INACTIVE SENSORS" count based on the configurable timeout.
*   **Recent Alerts Log**: A real-time list of the last 20 triggered events (High Occupancy, Low Confidence, Device Death).
