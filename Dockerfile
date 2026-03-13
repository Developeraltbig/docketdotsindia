# ============================
# 1) Build Client (Vite/React)
# ============================
FROM node:20 AS client-build

WORKDIR /app/client

# Install dependencies
COPY client/package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY client/ .
RUN npm run build


# ============================
# 2) Build Server
# ============================
FROM node:20 AS final-build

WORKDIR /app/server

# Copy server package files
COPY server/package*.json ./
RUN npm install --only=production

# Copy server source
COPY server/ .

# Copy client build output into server "public"
COPY --from=client-build /app/client/dist ./public

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "index.js"]
