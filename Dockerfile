FROM node:22-alpine AS build
WORKDIR /workspace

COPY package.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --no-audit --no-fund

COPY . .
ARG VITE_ROOM_SERVER_URL=
ENV VITE_ROOM_SERVER_URL=${VITE_ROOM_SERVER_URL}
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /workspace
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001

COPY package.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --omit=dev --workspace @rival/server --workspace @rival/shared --no-audit --no-fund

COPY --from=build /workspace/apps/server/dist apps/server/dist
COPY --from=build /workspace/packages/shared/dist packages/shared/dist
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "@rival/server"]

FROM nginx:alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/client/dist /usr/share/nginx/html
EXPOSE 80
