# TeraSpot - Intelligent Parking Management System

Full-stack IoT solution combining edge computing (fog) with AWS serverless backend.

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 22+
- Docker
- AWS CLI configured

### Local Development

```
# Setup fog layer
cd fog
pip install -r requirements.txt
python docker/src/yolo_processor.py 

# Setup backend (requires AWS credentials)
cd ../backend
# Lambda testing locally with SAM or invoke

# Setup frontend
cd ../frontend/parking-status-app
npm install
npm start
```

## Project Structure

```
teraspot/
├── fog/                 # Edge computing (Python + YOLO + MQTT)
├── backend/             # Serverless lambdas (Python)
├── frontend/            # Web applications (React/Vue)
├── infrastructure/      # IaC (CloudFormation/Terraform)
├── .github/workflows/   # CI/CD pipelines
├── docs/                # Architecture & deployment docs
└── scripts/             # Automation scripts
```

## License
See LICENSE file