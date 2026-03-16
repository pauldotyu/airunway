# CRD Reference

## ModelDeployment
Unified API for deploying ML models.

```yaml
apiVersion: airunway.ai/v1alpha1
kind: ModelDeployment
metadata:
  name: my-model
  namespace: default
spec:
  model:
    id: "Qwen/Qwen3-0.6B"       # HuggingFace model ID
    source: huggingface          # huggingface or custom
  engine:
    type: vllm                   # vllm, sglang, trtllm, llamacpp (optional, auto-selected)
    contextLength: 32768
    trustRemoteCode: false
  provider:
    name: ""                     # Optional: explicit provider selection
  serving:
    mode: aggregated             # aggregated or disaggregated
  resources:
    gpu:
      count: 1
      type: "nvidia.com/gpu"
  scaling:
    replicas: 1
  gateway:
    enabled: true                # Optional: defaults to true when Gateway detected
    modelName: ""                # Optional: override model name for routing
```

> **Note:** If `gateway.enabled` is explicitly set to `true` but the Gateway API Inference Extension CRDs are not installed, the controller sets a `GatewayReady=False` condition with reason `CRDsNotAvailable`. This surfaces as a status warning on the `ModelDeployment`.

## InferenceProviderConfig
Cluster-scoped resource for provider registration. Each provider controller self-registers its `InferenceProviderConfig` at startup, declaring capabilities, selection rules, and installation info:

```yaml
apiVersion: airunway.ai/v1alpha1
kind: InferenceProviderConfig
metadata:
  name: dynamo
spec:
  capabilities:
    engines: [vllm, sglang, trtllm]
    servingModes: [aggregated, disaggregated]
    gpuSupport: true
    cpuSupport: false
  selectionRules:
    - condition: "spec.serving.mode == 'disaggregated'"
      priority: 100
  installation:
    description: "NVIDIA Dynamo for high-performance GPU inference"
    defaultNamespace: dynamo-system
    helmRepos:
      - name: nvidia-ai-dynamo
        url: https://helm.ngc.nvidia.com/nvidia/ai-dynamo
    helmCharts:
      - name: dynamo-platform
        chart: https://helm.ngc.nvidia.com/nvidia/ai-dynamo/charts/dynamo-platform-1.0.0.tgz
        namespace: dynamo-system
        createNamespace: true
        values:
          global.grove.install: true
    steps:
      - title: Install Dynamo Platform
        command: "helm upgrade --install dynamo-platform https://helm.ngc.nvidia.com/nvidia/ai-dynamo/charts/dynamo-platform-1.0.0.tgz --namespace dynamo-system --create-namespace --set-json global.grove.install=true"
        description: Install the Dynamo platform operator with bundled Grove enabled by default and bundled CRDs
status:
  ready: true
  version: "dynamo-provider:v0.2.0"
```

## See also

- [Architecture Overview](architecture.md)
- [Controller Architecture](controller-architecture.md)
