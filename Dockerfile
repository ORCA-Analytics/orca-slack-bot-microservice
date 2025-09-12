# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copy only runtime deps
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Security: drop root
RUN addgroup -S app && adduser -S node -G app
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
