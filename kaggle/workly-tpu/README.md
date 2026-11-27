# Workly India Kaggle TPU Lab

This folder contains a Kaggle notebook entry point and GitHub Actions publisher.

## One-time GitHub setup

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `KAGGLE_API_TOKEN`: create an API token in your Kaggle account settings. Keep it private.
- `KAGGLE_USERNAME`: your Kaggle username (not your email).
- `KAGGLE_KERNEL_SLUG`: a lowercase slug for the notebook, for example `workly-india-tpu-lab`.

Do not commit API tokens or kaggle.json files.

## Run

1. Add the three repository secrets above.
2. Open **Actions → Workly India Kaggle TPU**.
3. Select **Run workflow** and leave **Run the Kaggle notebook on TPU** enabled.
4. The workflow creates/updates the private notebook and asks Kaggle to execute it with `TpuV5E8` (TPU v5e-8).
5. Check the Kaggle notebook's version, logs and output for the actual execution result. Kaggle may queue or deny TPU access depending on account quota and accelerator availability.

A push changing this folder also publishes and runs the notebook on Kaggle TPU. Use workflow_dispatch with the toggle disabled to save a version without running it.

## Current scope and ChatWork compatibility

The first notebook is a TPU runtime smoke test. It verifies that PyTorch/XLA can allocate a TPU device and execute a matrix operation. It does not train or serve a production chat model yet.

ChatWork's current Android offline models are GGUF files executed by llama.cpp. They cannot be assumed to run on TPU as-is. A separate compatible model pipeline (for example Transformers/PyTorch-XLA or JAX), model-format/export checks, and quality/performance evaluation are required before connecting a TPU-trained model back to Android. Kaggle notebook execution is an on-demand job, not a permanently hosted inference API.

The notebook is private by default. Do not add personal data or secrets to notebook output.
