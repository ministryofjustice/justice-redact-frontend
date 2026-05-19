# -----------------------------
# Stage 1: Install dependencies
# -----------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first (better caching)
COPY package.json package-lock.json* ./

# Copy the scripts folder so the postinstall script can find it
COPY scripts/ ./scripts/

# Install production dependencies only
RUN npm ci --omit=dev


# -----------------------------
# Stage 2: Runtime
# -----------------------------
FROM node:20-alpine

WORKDIR /app

# Set production env
ENV NODE_ENV=production

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full app source
COPY . .

# Use non-root user (best practice)
USER node

# App port (MOJ apps usually 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
