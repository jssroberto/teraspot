# Shared Packages

Code shared between `admin` and `client` is located in `packages/`. This ensures visual consistency and robust logic.

## 1. UI Library (`@repo/ui`)
**Path**: `packages/ui`
**Purpose**: Dumb presentation components.

*   **Platform Agnostic**: Components are built using bare usage of `react-native`, ensuring they render correctly on Web (`<div>/<span>` via react-native-web) and Mobile (Native Views).
*   **Components**:
    *   `Button`: Standard branded button.
    *   `Card`: Container with shadow/elevation.
    *   `Code`: Monospace text display.

## 2. Core Logic (`@repo/core`)
**Path**: `packages/core`
**Purpose**: Business logic, API clients, and TypeScript types.

*   **`api.ts`**: Axios instance configured with base URLs and interceptors.
*   **`mock-kpi.ts`**: Utilities for generating fake data during development/demos.
*   **Types**: Shared interfaces for API responses (e.g., `ParkingSpace`, `OccupancyEvent`).

## 3. Configuration Packages
*   `@repo/eslint-config`: Shared linting rules (ESLint).
*   `@repo/typescript-config`: Shared `tsconfig.json` base.
