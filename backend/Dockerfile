FROM node:24-alpine
WORKDIR /app

# Prisma needs OpenSSL at generate/runtime; Alpine ships OpenSSL 3 (libssl.so.3).
# Without this, Prisma falls back to the openssl-1.1.x engine and fails to load.
RUN apk add --no-cache openssl

# Dev deps are kept so `npx prisma db push` / `npx tsx prisma/seed.ts`
# can be executed inside the container (see README Docker steps).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate && npx tsc

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
