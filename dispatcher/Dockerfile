FROM node:18-slim

WORKDIR /app

# Copy only the necessary files
COPY package.json .
COPY package-lock.json* .

# Install production dependencies only
RUN npm ci --only=production

# Copy application code with updated paths
COPY Engine ./Engine
COPY Events ./Events
COPY Pipelines ./Pipelines

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

CMD [ "npm", "start" ]
