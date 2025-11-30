# TeraSpot KPI Aggregator Service

## Overview

[cite_start]This Lambda function acts as the central intelligence engine for the TeraSpot Dashboard[cite: 5]. It aggregates data from DynamoDB (Real-time) and historical logs to calculate Key Performance Indicators (KPIs) across three operational levels:

1.  [cite_start]**Operational (Real-time):** Immediate capacity and status for daily operations[cite: 8].
2.  [cite_start]**System Health (Performance):** IoT device status and AI model confidence[cite: 38].
3.  [cite_start]**Analytics (Historical):** Trends, peak hours, and usage duration[cite: 82].

## Integration via API Gateway

The service is exposed via a single API Gateway endpoint. It supports fetching the entire dashboard state or individual widget data.

- **Method:** `POST`
- **Content-Type:** `application/json`

---

## TypeScript Integration Guide

Use the following interfaces to ensure type safety in your frontend (React/Angular) or backend (Node.js) application.

### 1. Request Payload

Send this structure to the API Gateway.

```typescript
/**
 * Request payload for KPI Data
 */
export interface KPIRequest {
  /**
   * The specific KPI to retrieve. 
   * Use 'all' to fetch the complete dashboard dataset.
   */
  kpi: KPIIdentifier | 'all';

  /**
   * Optional configuration to override default calculation windows.
   */
  params?: KPIParams;
}

export type KPIIdentifier = 
  | 'occupancy_rate'        // Level 1: Current capacity %
  | 'vacant_spaces'         // Level 1: Available spots count
  | 'critical_capacity'     // Level 1: >95% alert
  | 'detection_confidence'  // Level 2: AI Model accuracy
  | 'low_confidence_rate'   // Level 2: Quality assurance metric
  | 'system_health'         // Level 2: Device uptime
  | 'parking_duration'      // Level 3: Avg stay time
  | 'peak_hours'            // Level 3: Busiest times
  | 'occupancy_trend';      // Level 3: Historical graph

export interface KPIParams {
  time_window_minutes?: number;        // Default: 15
  days_back?: number;                  // Default: 7 or 30
  hours_back?: number;                 // Default: 24
  interval_minutes?: number;           // Default: 60
  inactive_threshold_minutes?: number; // Default: 5 (for system health)
  threshold?: number;                  // Default: 0.75 (for confidence)
}