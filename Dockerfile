FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create necessary directories
RUN mkdir -p logs data

CMD ["node", "miner.js"]
