FROM node:20-slim

WORKDIR /app

# Install Python, pip, yt-dlp, ffmpeg, and yarn
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g yarn --force

# Copy package files
COPY package.json yarn.lock ./

# Install all dependencies
RUN yarn install --frozen-lockfile

# Copy TypeScript config and source files
COPY tsconfig.json .
COPY src ./src

# Build TypeScript
RUN yarn build

# Remove dev dependencies to reduce image size (unless KEEP_DEV_DEPS is set)
ARG KEEP_DEV_DEPS=false
RUN if [ "$KEEP_DEV_DEPS" != "true" ]; then yarn install --production --frozen-lockfile; fi

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

CMD [ "yarn", "start" ]

