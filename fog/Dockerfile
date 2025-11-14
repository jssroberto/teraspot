FROM python:3.12-slim AS build

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -sSL https://install.python-poetry.org | POETRY_VERSION=2.2.1 python3 -

ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app
COPY pyproject.toml poetry.lock* /app/

RUN poetry config virtualenvs.create false && poetry install --no-dev --no-interaction --no-ansi

COPY . /app/

# 2nd stage for smaller runtime image
FROM python:3.12-slim

RUN useradd -m appuser

COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=build /app /app

WORKDIR /app

USER appuser

CMD ["poetry", "run", "python", "src/edge_publisher.py", "--use-yolo", "--iterations", "-1", "--interval", "5"]
