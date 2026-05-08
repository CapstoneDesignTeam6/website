# ── 1단계: 빌드 ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .

# 프로덕션 빌드 (dist/ 생성)
RUN npm run build

# ── 2단계: nginx 서빙 ──────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
