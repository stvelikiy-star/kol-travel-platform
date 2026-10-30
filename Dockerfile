FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_SOURCE_MODE=mock
ENV KOL_DEPLOYMENT_ENV=development
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN useradd --system --uid 10001 --create-home kol
COPY --from=build --chown=kol:kol /app/.next ./.next
COPY --from=build --chown=kol:kol /app/public ./public
COPY --from=build --chown=kol:kol /app/node_modules ./node_modules
COPY --from=build --chown=kol:kol /app/package.json ./package.json
USER kol
EXPOSE 3000
CMD ["npm","run","start"]
