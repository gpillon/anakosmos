# Build Frontend
FROM node:24-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Build Backend
FROM golang:1.25-alpine as backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o anakosmos-server main.go

# Final Stage
FROM alpine:latest
WORKDIR /app
COPY --from=backend-builder /app/backend/anakosmos-server .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080
ENTRYPOINT ["./anakosmos-server"]
