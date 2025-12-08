# Deployment & Hardware

## Hardware Requirements
The software is optimized for **NVIDIA Jetson** devices but is containerized to run on any Linux host with Docker.

*   **Recommended**: NVIDIA Jetson Nano / Orin Nano (for GPU acceleration).
*   **Minimal**: Raspberry Pi 4 (Slow inference, high latency).
*   **Simulation**: AWS EC2 EC2 `g4dn.xlarge` (GPU enabled) or standard `t3.medium` (CPU only).

## Docker Environment
The application is fully containerized.

### Build
```bash
docker build -t teraspot-fog:latest ./fog
```

### Run
```bash
docker run -d \
  --name fog-node \
  --device /dev/video0 \  # Pass through USB camera
  -e AWS_IOT_ENDPOINT=... \
  -e AWS_IOT_THING_NAME=... \
  teraspot-fog:latest
```

## Environment Variables
The container is configured via `.env` file or runtime flags:

| Variable | Description |
| :--- | :--- |
| `AWS_IOT_ENDPOINT` | The MQTT Broker URL (e.g., `xxx.iot.us-east-1.amazonaws.com`). |
| `AWS_IOT_THING_NAME` | The unique ID of this device (matches Certificate). |
| `AWS_IOT_FACILITY_ID` | Grouping ID for physical location (e.g., `Downtown-Garage`). |
| `AWS_IOT_ZONE_ID` | Sub-grouping ID (e.g., `Level-2`). |
| `AWS_IOT_CERT_PATH` | Directory containing the x.509 certificates. |

## Certificates
AWS IoT requires mutual TLS (mTLS). You must provision:
1.  `device-certificate.pem.crt`
2.  `private-key.pem.key`
3.  `AmazonRootCA1.pem`

These must be mounted into the container at the path specified by `AWS_IOT_CERT_PATH`. 
**Security Note**: Never commit these keys to Git. They are ignored by `.gitignore`.
