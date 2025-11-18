FROM python:3.12-slim AS build

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app/

# Runtime stage
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser

RUN mkdir -p /home/appuser/.config/Ultralytics && \
    chown -R appuser:appuser /home/appuser/.config

WORKDIR /app

COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

COPY --from=build /app /app

RUN find /app -type d -name "__pycache__" -exec rm -rf {} + || true

RUN chown -R appuser:appuser /app

USER appuser

CMD ["python", "src/edge_publisher.py", "--use-yolo", "--video", "assets/parking_lot.mp4", "--frame-skip", "5", "--iterations", "-1", "--interval", "5"]
