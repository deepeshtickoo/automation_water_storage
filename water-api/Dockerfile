FROM node:22-alpine
WORKDIR /app
ENV NODE_PATH=/app/node_modules
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
CMD ["sh", "-c", "if [ -f /share/water-api.js ]; then exec node /share/water-api.js; else exec node /app/server.js; fi"]
