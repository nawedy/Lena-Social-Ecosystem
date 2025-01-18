# Build stage
FROM node:18-alpine as builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install production dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Install security updates and Cloud SDK dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl python3 py3-pip && \
    pip3 install --no-cache-dir google-cloud-storage google-cloud-logging && \
    rm -rf /var/cache/apk/* /root/.cache

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Set environment variables
ENV NODE_ENV=production
# Use Cloud Run's PORT environment variable
ENV PORT=8080

# Expose port
EXPOSE 3000

# Start application with Cloud Run compatibility
CMD ["node", "dist/index.js"]
