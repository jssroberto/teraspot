FROM python:3.12-slim AS build

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://install.python-poetry.org | POETRY_VERSION=2.2.1 python3 -

ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app

COPY pyproject.toml poetry.lock* README.md /app/

RUN poetry config virtualenvs.create false && \
    poetry source add --priority=explicit pytorch-cpu https://download.pytorch.org/whl/cpu && \
    poetry install --no-root --no-interaction --no-ansi

COPY . /app/

# Runtime stage
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser

RUN mkdir -p /home/appuser/.config/Ultralytics && \
    chown -R appuser:appuser /home/appuser/.config

WORKDIR /app

COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

COPY --from=build /app /app

RUN chown -R appuser:appuser /app

USER appuser

CMD ["python", "src/edge_publisher.py", "--use-yolo", "--iterations", "-1", "--interval", "5"]
