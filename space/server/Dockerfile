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

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S colyseus -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R colyseus:nodejs /app
USER colyseus

# Expose the port the app runs on
EXPOSE 2567

# Set environment variables
ENV NODE_ENV=production
ENV PORT=2567

# Command to run the application
CMD ["node", "dist/index.js"]