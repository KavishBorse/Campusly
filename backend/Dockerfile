FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev

COPY backend ./backend

ENV NODE_ENV=production
EXPOSE 4001

CMD ["npm", "run", "start", "--workspace", "backend"]
