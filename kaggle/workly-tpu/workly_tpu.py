"""Workly India TPU runtime and benchmark report.

This validates Kaggle TPU availability with a small matrix benchmark. It does
not load Qwen3.6-27B or claim model tokens/second. ChatWork GGUF/llama.cpp
models are not directly runnable on TPU; a separate XLA/JAX model pipeline is
required.
"""
from __future__ import annotations

import json
import os
import platform
import sys
import time
from datetime import datetime, timezone


def main() -> None:
    started = time.perf_counter()
    report = {
        "project": "Workly India",
        "purpose": "Kaggle TPU runtime smoke test and hardware benchmark",
        "model_tested": None,
        "model_inference_tokens_per_second": None,
        "model_inference_status": "NOT_RUN_MODEL_NOT_CONFIGURED",
        "kaggle_remaining_quota": "NOT_EXPOSED_BY_THIS_NOTEBOOK",
        "python": sys.version,
        "platform": platform.platform(),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    print("=== Workly India Kaggle TPU Lab ===")
    print(json.dumps(report, indent=2))

    try:
        import torch
        import torch_xla
        import torch_xla.core.xla_model as xm
    except Exception as exc:
        raise RuntimeError(
            "PyTorch/XLA is not available in this Kaggle TPU image. "
            "Select a TPU accelerator in Kaggle and use a compatible Kaggle image."
        ) from exc

    device = xm.xla_device()
    print(f"PyTorch: {torch.__version__}")
    print(f"torch_xla: {getattr(torch_xla, '__version__', 'version unavailable')}")
    print(f"XLA device: {device}")

    n = 1024
    a = torch.randn((n, n), device=device, dtype=torch.bfloat16)
    b = torch.randn((n, n), device=device, dtype=torch.bfloat16)
    # Warm up compilation separately so measured time reflects execution after
    # the initial XLA compile as closely as this short smoke test allows.
    _ = a @ b
    xm.mark_step()
    _ = _.float().mean().cpu().item()

    iterations = 5
    t0 = time.perf_counter()
    checksum = 0.0
    for _ in range(iterations):
        c = a @ b
        xm.mark_step()
        checksum += float(c.float().mean().cpu().item())
    benchmark_seconds = time.perf_counter() - t0
    total_flops = 2 * (n ** 3) * iterations
    memory_info = None
    try:
        memory_info = xm.get_memory_info(device)
    except Exception as exc:
        memory_info = {"unavailable_reason": str(exc)[:240]}

    elapsed = time.perf_counter() - started
    result = {
        **report,
        "status": "TPU_SMOKE_TEST_PASSED",
        "device": str(device),
        "torch_version": torch.__version__,
        "torch_xla_version": getattr(torch_xla, "__version__", "unknown"),
        "matrix_shape": [n, n],
        "dtype": "bfloat16",
        "iterations": iterations,
        "benchmark_seconds": round(benchmark_seconds, 4),
        "matrix_operations_per_second": round(iterations / benchmark_seconds, 3) if benchmark_seconds else None,
        "approx_matrix_tflops": round(total_flops / benchmark_seconds / 1e12, 4) if benchmark_seconds else None,
        "xla_memory_info_bytes": memory_info,
        "mean_checksum": checksum / iterations,
        "elapsed_seconds": round(elapsed, 3),
        "elapsed_minutes": round(elapsed / 60, 3),
        "model_inference_tokens_per_second": None,
        "model_inference_status": "NOT_RUN_MODEL_NOT_CONFIGURED",
        "kaggle_remaining_quota": "NOT_EXPOSED_BY_THIS_NOTEBOOK",
    }
    os.makedirs("/kaggle/working", exist_ok=True)
    with open("/kaggle/working/workly-tpu-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("=== MACHINE-READABLE RESULT ===")
    print(json.dumps(result, indent=2))
    print("TPU smoke test passed. No Qwen model was loaded or benchmarked.")


if __name__ == "__main__":
    main()
