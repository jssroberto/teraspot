# Applications

## 1. Admin Dashboard (`apps/admin`)
**Audience**: Facility Managers, System Administrators.
**Purpose**: Monitor system health, view analytics, and configure camera ROIs.

### Key Features
*   **Authentication**: Uses Amazon Cognito (via `aws-amplify`) for secure login.
*   **ROI Editor**: Interactive canvas to draw polygons over camera feeds, defining where parking spots are.
*   **KPI Dashboard**: Visualizes data like "Occupancy Rate" and "Peak Hours".
*   **Device Management**: Status of Edge devices (Online/Offline).

### Structure (`app/`)
*   `login.tsx`: Auth screen.
*   `(tabs)/`: Main navigation (Dashboard, Cameras, Settings).
*   `editor/[id].tsx`: The ROI drawing tool.

---

## 2. Client App (`apps/client`)
**Audience**: End Users (Drivers).
**Purpose**: Find available parking spots in real-time.

### Key Features
*   **Real-Time Map**: Shows a map of the parking lot with spots colored Green (Vacant) or Red (Occupied/Reserved).
*   **Fast Updates**: Connects via WebSockets to receive status changes instantly (< 1s latency).
*   **Anonymous**: No login required for basic viewing.

### Structure (`app/`)
*   `(tabs)/`: Simple navigation (Map, List View).
*   `_layout.tsx`: Configures the navigation stack.
