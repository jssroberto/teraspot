#!/bin/bash
echo "Running local verification tests..."
python scripts/verify_analytics.py
python scripts/verify_health_check.py
