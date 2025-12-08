# Frontend Monorepo Documentation

## Overview
The TeraSpot frontend is organized as a **Monorepo** using **Turborepo** and **pnpm** workspaces. This allows us to share code (UI components, API logic, configs) between multiple applications efficiently.

**Framework**: [Expo](https://expo.dev) (React Native) is used for all applications, enabling them to run on **iOS**, **Android**, and the **Web** from a single codebase.

## Directory Structure (`frontend/`)

| Directory | Type | Description |
| :--- | :--- | :--- |
| **`apps/`** | Applications | The actual deployable apps (Admin, Client). |
| **`packages/`** | Libraries | Shared code imported by apps (`import { Button } from "@repo/ui"`). |

## Core Technologies
*   **Language**: TypeScript
*   **Build System**: Turborepo (Fast, cached builds)
*   **Package Manager**: pnpm (Efficient disk usage)
*   **Routing**: Expo Router (File-system based routing like Next.js)
*   **Styling**: React Native StyleSheet / Inline styles

## Detailed Documentation
*   **[Applications](./frontend.APPS.md)**: Breakdown of the **Client App** and **Admin Dashboard**.
*   **[Shared Packages](./frontend.PACKAGES.md)**: Documentation for `@repo/ui` and `@repo/core`.
*   **[Development Guide](./frontend.DEVELOPMENT.md)**: How to set up the environment and run the apps locally.
