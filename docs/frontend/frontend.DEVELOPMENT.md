# Development Guide

## Prerequisities
*   Node.js >= 18
*   pnpm (Package Manager)
*   Expo Go (on your phone) OR Android Emulator / iOS Simulator

## Setup

1.  **Install pnpm**:
    ```bash
    npm install -g pnpm
    ```

2.  **Install Dependencies**:
    Run this from the `frontend/` root:
    ```bash
    pnpm install
    ```

## Running Applications

We use **Turbo** to manage tasks.

### Run Everything
To start both apps in Web mode:
```bash
pnpm dev
# Opens:
# Client: http://localhost:8081
# Admin:  http://localhost:8082
```

### Run Specific App
To run just one app (e.g., `client`):
```bash
cd apps/client
pnpm start
```
From here, you can press:
*   `w` for Web
*   `a` for Android
*   `i` for iOS

## Network Configuration
When running on a physical device via Expo Go:
1.  Ensure your phone and computer are on the **same Wi-Fi**.
2.  If the app cannot connect to the backend (localhost), you may need to replace `localhost` with your computer's local IP address (e.g., `192.168.1.50`) in the config.
