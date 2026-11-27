"""Workly India TPU notebook entry point.

This is an accelerator validation baseline. It deliberately does not claim that
ChatWork's Android GGUF/llama.cpp model can run on TPU unchanged. TPU model
training/inference needs a TPU-compatible PyTorch/XLA or JAX model pipeline.
"""

from __future__ import annotations

import json
import os
import platform
import sys
import time


def main() -> None:
    report = {
        "project": "Workly India",
        "purpose": "Kaggle TPU runtime validation",
        "python": sys.version,
        "platform": platform.platform(),
        "started_at_unix": time.time(),
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

    # Small TPU smoke test: allocate, execute a matrix operation, and force
    # synchronization so an asynchronous device error is not missed.
    a = torch.randn((1024, 1024), device=device, dtype=torch.bfloat16)
    b = torch.randn((1024, 1024), device=device, dtype=torch.bfloat16)
    c = a @ b
    xm.mark_step()
    checksum = float(c.float().mean().cpu().item())

    result = {
        **report,
        "status": "TPU_SMOKE_TEST_PASSED",
        "device": str(device),
        "matrix_shape": [1024, 1024],
        "dtype": "bfloat16",
        "mean_checksum": checksum,
    }
    os.makedirs("/kaggle/working", exist_ok=True)
    with open("/kaggle/working/workly-tpu-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(json.dumps(result, indent=2))
    print("TPU is ready for a compatible Workly AI training/inference workload.")


if __name__ == "__main__":
    main()
