# Stage 1: Build & Generate
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY prisma ./prisma

# Install dependencies (this will install Prisma CLI as well)
RUN bun install --frozen-lockfile

# Generate Prisma Client (crucial step to build the query engine for this specific linux container)
RUN bunx prisma generate

# Copy the rest of the application
COPY . .

# If you had a build step (like transpiling TS to JS), it would go here. 
# But Bun can run TS directly!

# Stage 2: Runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Copy only what we need from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/generated ./generated

# Default to production environment
ENV NODE_ENV=production
# Fallback port (Railway will inject its own PORT at runtime, overriding this)
ENV PORT=3000
EXPOSE $PORT

# Start the application using Bun
CMD ["bun", "src/index.ts"]
