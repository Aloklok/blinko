# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install Bun 1.2.8 via official script for better architecture compatibility (ARM64/x64)
RUN apk add --no-cache curl unzip bash && \
    curl -fsSL https://bun.sh/install | bash -s -- bun-v1.2.8

# Set Bun path
ENV PATH="/root/.bun/bin:${PATH}"

# Set Sharp environment variables
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Set Prisma environment variables to optimize installation
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Copy Project Files
COPY . .
RUN mkdir -p /app/plugins

# Install Dependencies and Build App
RUN bun install --unsafe-perm

# Generate Prisma Client (Includes both native and linux-musl targets)
# Config is loaded from prisma.config.mjs which is copied with COPY . .
RUN bun x prisma generate

# Build Web App
RUN bun run build:web
RUN bun run build:seed

# Create startup script
RUN printf '#!/bin/sh\nset -e\necho "Current Environment: $NODE_ENV"\nnpx prisma migrate deploy\nnode server/seed.mjs\nnode server/index.js\n' > start.sh && \
    chmod +x start.sh


FROM node:20-alpine as init-downloader

WORKDIR /app

RUN wget -qO /app/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_$(uname -m) && \
    chmod +x /app/dumb-init && \
    rm -rf /var/cache/apk/*


# Runtime Stage - Using Node 22 to fully support Prisma 7
FROM node:22-alpine AS runner

WORKDIR /app

# Environment Variables
ENV NODE_ENV=production
# If there is a proxy or load balancer behind HTTPS, you may need to disable secure cookies
ENV DISABLE_SECURE_COOKIE=false
# Set Trust Proxy
ENV TRUST_PROXY=1
# Set Sharp environment variables
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Install runtime dependencies (openssl is required for Prisma)
RUN apk add --no-cache openssl vips-dev

# Copy Build Artifacts
COPY --from=builder /app/dist ./server
COPY --from=builder /app/server/lute.min.js ./server/lute.min.js
COPY --from=builder /app/prisma ./prisma
# Copy the pre-generated client from builder
COPY --from=builder /app/server/generated/client ./server/generated/client
COPY --from=builder /app/start.sh ./
COPY --from=builder /app/prisma.config.mjs ./
COPY --from=init-downloader /app/dumb-init /usr/local/bin/dumb-init

# Copy built-in plugins
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/server/vditor ./server/vditor

RUN chmod +x ./start.sh

# Install production dependencies
COPY server/package.json ./package.json

# 1. Install dependencies from package.json (production only)
# 2. Add dependencies needed for runtime but missing from server/package.json if any
# NOTE: We use npm here to ensure compatibility with standard node modules, 
# but we could use bun if we copied it. Sticking to npm for runner stability as per original.
# We DO NOT install global prisma or build tools anymore.
RUN echo "Installing production dependencies..." && \
    npm install --omit=dev --legacy-peer-deps && \
    # We need prisma CLI for 'npx prisma migrate deploy' in start.sh, so we install it locally
    npm install prisma@7.3.0 --save-exact --legacy-peer-deps && \
    # Add missing deps referenced in start.sh/server if not in package.json
    npm install pg lru-cache@11.1.0 uint8array-extras tsx --save-exact --legacy-peer-deps && \
    rm -rf /tmp/* && \
    rm -rf /root/.npm /root/.cache

# Expose Port
EXPOSE 1111

CMD ["/usr/local/bin/dumb-init", "--", "/bin/sh", "-c", "./start.sh"]
