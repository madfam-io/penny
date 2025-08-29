# Multi-stage build for Python sandbox container
FROM python:3.11-slim as base

# Create sandbox user
RUN groupadd -r sandbox && useradd -r -g sandbox -u 1000 sandbox

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libc6-dev \
    libffi-dev \
    libssl-dev \
    libxml2-dev \
    libxslt1-dev \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    pkg-config \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set up Python environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install Python dependencies
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Create directories with proper permissions
RUN mkdir -p /sandbox/python /workspace /tmp/plots /tmp/data && \
    chown -R sandbox:sandbox /sandbox /workspace /tmp/plots /tmp/data

# Copy Python runtime files
COPY python/ /sandbox/python/
RUN chown -R sandbox:sandbox /sandbox/python && \
    chmod -R 755 /sandbox/python

# Security hardening
RUN chmod 755 /tmp && \
    chmod 755 /workspace

# Set working directory
WORKDIR /workspace

# Switch to sandbox user
USER sandbox

# Set Python path
ENV PYTHONPATH=/sandbox/python:/workspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Default command
CMD ["python", "-c", "import time; time.sleep(86400)"]