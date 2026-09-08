# Build stage
FROM golang:1.23-alpine AS build
WORKDIR /src

# The auth module is a sibling directory referenced by a replace directive, so
# both module roots have to be present before dependencies resolve.
COPY auth/go.mod ./auth/
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /src/backend
RUN go mod download

WORKDIR /src
COPY auth/ ./auth/
COPY backend/ ./backend/
WORKDIR /src/backend
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# Runtime stage: distroless, non-root, no shell to be dropped into.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
EXPOSE 8085
USER nonroot:nonroot
ENTRYPOINT ["/api"]
