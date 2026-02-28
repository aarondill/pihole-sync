FROM node:25-alpine
WORKDIR /app

RUN npm install -g pnpm

CMD ["pnpm", "start"]

# Copy lock file if present
COPY package.json /app
RUN pnpm install --prod

COPY . /app
