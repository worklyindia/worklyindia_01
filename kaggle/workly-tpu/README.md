# Workly India Kaggle TPU Lab

This folder contains a private Kaggle notebook entry point and a GitHub Actions publisher with a machine-readable TPU and Qwen inference benchmark report.

## One-time GitHub setup

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `KAGGLE_API_TOKEN`: create an API token in your Kaggle account settings. Keep it private.
- `KAGGLE_USERNAME`: your Kaggle username (not your email).
- `KAGGLE_KERNEL_SLUG`: a lowercase slug for the notebook, for example `workly-india-tpu-lab`.

Do not commit API tokens or kaggle.json files.

## Publish without spending TPU quota

A push changing this folder only publishes a new private notebook version; it does not start a TPU session. This is the default and recommended path for code-only updates.

## Run a TPU benchmark only when needed

1. Open **Actions → Workly India Kaggle TPU**.
2. Select **Run workflow**.
3. Enable **Run the Kaggle notebook on TPU** only when you are ready to use accelerator quota.
4. The workflow requests `TpuV5E8` (TPU v5e-8), waits for Kaggle completion, downloads the result JSON, and verifies the smoke-test status.

Kaggle may queue or deny TPU access depending on account quota and accelerator availability. Remaining account quota is not exposed by this notebook report; check your Kaggle account settings for quota.

## What the report measures

After a successful TPU run, the GitHub Actions run summary and downloadable artifact `workly-kaggle-tpu-report` include:

- TPU smoke-test pass/fail and detected XLA device
- Elapsed notebook execution time (not a guaranteed billable/quota-minute figure)
- Small BF16 matrix benchmark duration, operations/second and approximate TFLOP/s
- XLA memory information when the Kaggle runtime exposes it
- Qwen3-4B-Instruct-2507 BF16 inference status, generated-token count, short output preview, and measured tokens/second (only when inference succeeds)

**Model under test:** `Qwen/Qwen3-4B-Instruct-2507` (BF16, Transformers). This is a practical first TPU test target: 4B parameters, instruction-tuned, multilingual, and Apache-2.0 licensed. The notebook now attempts a short real generation after the TPU matrix smoke test. A successful smoke test does not guarantee the Qwen inference path will work; model load/generation errors are captured separately in the JSON report. Actual TPU compatibility and tokens/second must be confirmed by running the notebook on your Kaggle account. See the official [Qwen model card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) and [Qwen repository](https://github.com/QwenLM/Qwen3).

## ChatWork compatibility

ChatWork's current Android offline models are GGUF files executed by llama.cpp. They cannot be assumed to run on TPU as-is. A separate compatible model pipeline (for example Transformers/PyTorch-XLA or JAX), model-format/export checks, and quality/performance evaluation are required before connecting a TPU-trained/inferred model back to Android. Kaggle notebook execution is an on-demand job, not a permanently hosted inference API.

The notebook is private by default. Do not add personal data or secrets to notebook output. The first model run downloads several GB of weights and may take longer than the hardware-only smoke test.
