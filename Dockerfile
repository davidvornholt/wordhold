FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS dependencies

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/a11y-testing/package.json packages/a11y-testing/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS build

COPY . .
RUN bun run --cwd apps/web build

FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS production-dependencies

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY packages/a11y-testing/package.json packages/a11y-testing/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS runtime

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/davidvornholt/wordhold"

ENV HOST=0.0.0.0
ENV HOME=/tmp
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/web/.output ./apps/web/.output
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/src ./packages/db/src
COPY --from=production-dependencies /app/packages/db/node_modules ./packages/db/node_modules
RUN chmod -R a+rX /app

EXPOSE 3000

USER 65532:65532

CMD ["bun", "run", "--cwd", "apps/web", "start"]
