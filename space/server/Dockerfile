# Use the official Node.js runtime as the base image
FROM node:20-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock for dependency installation
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the source code
COPY . .

# Build the TypeScript application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

# Install curl and other utilities
RUN apk add --no-cache curl wget

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Simple startup - just run Colyseus (LiveKit runs in separate container)

# Create a non-root user for security (Colyseus will run as this user)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nodejs:nodejs /app

# Expose port for Colyseus
EXPOSE 2567

# Set environment variables
ENV NODE_ENV=production
ENV PORT=2567

# Switch to non-root user
USER nodejs

# Start Colyseus server
CMD ["node", "dist/index.js"]