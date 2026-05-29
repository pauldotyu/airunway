# Build the provider binary
FROM --platform=$BUILDPLATFORM golang:1.25 AS builder
ARG TARGETOS
ARG TARGETARCH
ARG PROVIDER_VERSION

WORKDIR /workspace

# Disable workspace mode; use replace directives from go.mod
ENV GOWORK=off

# Copy controller dependency (referenced by go.mod replace directive)
COPY controller/go.mod controller/go.sum controller/

# Copy provider module manifests and download dependencies
COPY providers/kuberay/go.mod providers/kuberay/go.sum providers/kuberay/
RUN cd providers/kuberay && go mod download

# Copy the controller Go source
COPY controller/ controller/

# Copy the provider Go source
COPY providers/kuberay/ providers/kuberay/

# Ensure go.sum is complete for all transitive dependencies
RUN cd providers/kuberay && go mod tidy

# Build
RUN test -n "${PROVIDER_VERSION}" || (echo "ERROR: PROVIDER_VERSION build arg is required; pass --build-arg PROVIDER_VERSION=kuberay-provider:<version>" >&2; exit 1)
RUN cd providers/kuberay && CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} \
    go build -a \
      -ldflags="-X github.com/kaito-project/airunway/providers/kuberay.ProviderVersion=${PROVIDER_VERSION}" \
      -o provider cmd/main.go

# Use distroless as minimal base image to package the provider binary
FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY --from=builder /workspace/providers/kuberay/provider .
USER 65532:65532

ENTRYPOINT ["/provider"]
