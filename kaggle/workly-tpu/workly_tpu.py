"""Workly India Kaggle TPU smoke test and optional Qwen inference benchmark.

The TPU smoke test is always run. Qwen inference is attempted on the TPU after
the smoke test. A model failure is reported separately so hardware validation
remains distinguishable from model compatibility.
"""
from __future__ import annotations

import json
import os
import platform
import sys
import time
import traceback
from datetime import datetime, timezone


MODEL_ID = "Qwen/Qwen3-4B-Instruct-2507"


def main() -> None:
    started = time.perf_counter()
    report = {
        "project": "Workly India",
        "purpose": "Kaggle TPU smoke test and Qwen inference benchmark",
        "model_tested": MODEL_ID,
        "model_inference_tokens_per_second": None,
        "model_inference_status": "NOT_RUN",
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
            "Select a TPU accelerator and use a compatible Kaggle image."
        ) from exc

    device = xm.xla_device()
    print(f"PyTorch: {torch.__version__}")
    print(f"torch_xla: {getattr(torch_xla, '__version__', 'version unavailable')}")
    print(f"XLA device: {device}")

    n = 1024
    a = torch.randn((n, n), device=device, dtype=torch.bfloat16)
    b = torch.randn((n, n), device=device, dtype=torch.bfloat16)
    warmup = a @ b
    xm.mark_step()
    _ = warmup.float().mean().cpu().item()

    iterations = 5
    t0 = time.perf_counter()
    checksum = 0.0
    for _ in range(iterations):
        c = a @ b
        xm.mark_step()
        checksum += float(c.float().mean().cpu().item())
    benchmark_seconds = time.perf_counter() - t0
    total_flops = 2 * (n ** 3) * iterations
    try:
        memory_info = xm.get_memory_info(device)
    except Exception as exc:
        memory_info = {"unavailable_reason": str(exc)[:240]}

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
        "model_inference_tokens_per_second": None,
        "model_inference_status": "NOT_RUN",
        "kaggle_remaining_quota": "NOT_EXPOSED_BY_THIS_NOTEBOOK",
    }

    # Keep model inference isolated from the hardware smoke test. Kaggle's
    # preinstalled Transformers may be old, so install a Qwen3-capable version.
    try:
        import subprocess
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet",
             "--upgrade", "transformers>=4.52.4", "accelerate", "safetensors"],
            check=True,
        )
        from transformers import AutoModelForCausalLM, AutoTokenizer

        print(f"Loading {MODEL_ID} in BF16 on {device}...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=True,
            attn_implementation="eager",
            trust_remote_code=True,
        )
        model.to(device)
        model.eval()

        messages = [
            {"role": "system", "content": "You are Workly India AI. Reply clearly and helpfully in the user's language."},
            {"role": "user", "content": "Namaste! Explain in two short sentences how you can help a student find a job in India."},
        ]
        prompt = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = tokenizer(prompt, return_tensors="pt")
        inputs = {key: value.to(device) for key, value in inputs.items()}

        # Warm up once, then measure a short deterministic generation.
        with torch.inference_mode():
            warm = model.generate(**inputs, max_new_tokens=4, do_sample=False, use_cache=True)
            xm.mark_step()
            _ = warm.cpu()
            gen_start = time.perf_counter()
            output = model.generate(
                **inputs, max_new_tokens=48, do_sample=False, use_cache=True
            )
            xm.mark_step()
            output_ids = output.cpu()
        generation_seconds = time.perf_counter() - gen_start
        prompt_tokens = int(inputs["input_ids"].shape[-1])
        generated_tokens = max(0, int(output_ids.shape[-1]) - prompt_tokens)
        result.update({
            "model_inference_status": "QWEN_INFERENCE_PASSED",
            "model_output_preview": tokenizer.decode(
                output_ids[0, prompt_tokens:], skip_special_tokens=True
            )[:1200],
            "model_prompt_tokens": prompt_tokens,
            "model_generated_tokens": generated_tokens,
            "model_generation_seconds": round(generation_seconds, 3),
            "model_inference_tokens_per_second": round(
                generated_tokens / generation_seconds, 3
            ) if generation_seconds > 0 else None,
            "model_dtype": "bfloat16",
        })
        print("Qwen inference passed.")
    except Exception as exc:
        result.update({
            "model_inference_status": "QWEN_INFERENCE_FAILED",
            "model_inference_error": f"{type(exc).__name__}: {str(exc)[:1000]}",
            "model_inference_traceback": traceback.format_exc()[-3000:],
        })
        print("Qwen inference failed; TPU smoke test result remains available.")
        print(result["model_inference_error"])

    result["elapsed_seconds"] = round(time.perf_counter() - started, 3)
    result["elapsed_minutes"] = round(result["elapsed_seconds"] / 60, 3)
    os.makedirs("/kaggle/working", exist_ok=True)
    with open("/kaggle/working/workly-tpu-result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print("=== MACHINE-READABLE RESULT ===")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
