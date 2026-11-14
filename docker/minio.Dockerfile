# Build from official source because the old registry images are unavailable.
# Go builds for the Docker host's CPU, including Apple Silicon.
FROM golang:1.25-bookworm AS server-build
ARG MINIO_REVISION=master
RUN git clone --depth 1 --branch "$MINIO_REVISION" https://github.com/minio/minio.git /src
WORKDIR /src
RUN CGO_ENABLED=0 go build -trimpath -o /out/minio .

FROM golang:1.25-bookworm AS client-build
ARG MC_REVISION=master
RUN git clone --depth 1 --branch "$MC_REVISION" https://github.com/minio/mc.git /src
WORKDIR /src
RUN CGO_ENABLED=0 go build -trimpath -o /out/mc .

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

FROM runtime AS server
COPY --from=server-build /out/minio /usr/local/bin/minio
ENTRYPOINT ["minio"]

FROM runtime AS client
COPY --from=client-build /out/mc /usr/local/bin/mc
ENTRYPOINT ["mc"]
