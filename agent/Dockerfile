# Dockerfile for the bug detection agent orchestrator

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir -e .

# Create directories for results
RUN mkdir -p /app/results /app/reports

# Non-root user for security
RUN useradd -m -u 1000 agent
RUN chown -R agent:agent /app
USER agent

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

ENTRYPOINT ["python", "-m"]
CMD ["src.orchestrator", "--help"]
