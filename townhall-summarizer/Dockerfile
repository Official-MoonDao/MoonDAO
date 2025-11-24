FROM node:18-slim

WORKDIR /app

# Install yt-dlp
RUN apt-get update && \
    apt-get install -y yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json .
COPY package-lock.json* .

# Install all dependencies (including dev dependencies for TypeScript compilation)
RUN npm ci

# Copy TypeScript config and source files
COPY tsconfig.json .
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

CMD [ "npm", "start" ]

