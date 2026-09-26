# Builds the Go API. The build context is the repository root, because the
# backend module depends on the sibling auth module through a replace directive.

FROM golang:1.23-alpine AS build
WORKDIR /src

COPY auth/go.mod ./auth/
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /src/backend
RUN go mod download

WORKDIR /src
COPY auth/ ./auth/
COPY backend/ ./backend/
WORKDIR /src/backend
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# Distroless, non-root, no shell. The migrations ship alongside the binaries so
# `/app/migrate up` can run as a one-off job against the same image.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build /out/migrate /app/migrate
COPY database/migrations /app/database/migrations
EXPOSE 8085
USER nonroot:nonroot
ENTRYPOINT ["/app/api"]
