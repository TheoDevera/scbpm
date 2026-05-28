FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    librubberband2 \
    rubberband-cli \
    libsndfile1 \
    build-essential \
    pkg-config \
    libaubio-dev \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir setuptools && \
    pip download --no-deps aubio==0.4.9 -d /tmp/aubio-sdist && \
    tar xzf /tmp/aubio-sdist/aubio-0.4.9.tar.gz -C /tmp && \
    printf '#!/bin/sh\nexec /usr/bin/gcc "$@" -Wno-incompatible-pointer-types\n' > /tmp/gcc-wrap && \
    chmod +x /tmp/gcc-wrap && \
    CC=/tmp/gcc-wrap pip install --no-build-isolation /tmp/aubio-0.4.9/ && \
    rm -rf /tmp/aubio-sdist /tmp/aubio-0.4.9 /tmp/gcc-wrap

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /app/cache

EXPOSE 47823
ENTRYPOINT ["/entrypoint.sh"]