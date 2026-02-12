# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install Bun 1.2.8
RUN npm install -g bun@1.2.8

# Set Sharp environment variables
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Set Prisma environment variables to optimize installation
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Copy Project Files
COPY . .
RUN mkdir -p /app/plugins

# Install Dependencies and Build App
# Bun will now run in a Node 22 environment, satisfying Prisma 7's version check
RUN bun install --unsafe-perm
RUN bunx prisma generate
RUN bun run build:web
RUN bun run build:seed

RUN printf '#!/bin/sh\necho "Current Environment: $NODE_ENV"\nnpx prisma migrate deploy\nnode server/seed.js\nnode server/index.js\n' > start.sh && \
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

RUN apk add --no-cache openssl vips-dev python3 py3-setuptools make g++ gcc libc-dev linux-headers

# Copy Build Artifacts and Necessary Files
COPY --from=builder /app/dist ./server
COPY --from=builder /app/server/lute.min.js ./server/lute.min.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/start.sh ./
COPY --from=init-downloader /app/dumb-init /usr/local/bin/dumb-init

# Copy built-in plugins
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/server/vditor ./server/vditor

RUN chmod +x ./start.sh

# Install production dependencies
# Align Prisma version to project v7.3.0
RUN echo "Installing additional dependencies..." && \
    npm install @node-rs/crc32 lightningcss sharp@0.34.1 prisma@7.3.0 && \
    npm install -g prisma@7.3.0 && \
    npm install sqlite3@5.1.7 && \
    npm install llamaindex @langchain/community@0.3.40 && \
    npm install @libsql/client @libsql/core && \
    npx prisma generate && \
    rm -rf /tmp/* && \
    apk del python3 py3-setuptools make g++ gcc libc-dev linux-headers && \
    rm -rf /var/cache/apk/* /root/.npm /root/.cache

# Expose Port
EXPOSE 1111

CMD ["/usr/local/bin/dumb-init", "--", "/bin/sh", "-c", "./start.sh"]
