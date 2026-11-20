# Workly Voice Android — third-party model notices

## Indic Tiny TTS

Workly Voice integrates the ONNX exports of the Indic Tiny TTS models published by Sulabh Katiyar:

- Hindi: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-hindi
- Gujarati: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-gujarati
- Indian English: https://huggingface.co/sulabhkatiyar/indic-tiny-tts-english

The acoustic model weights and ONNX graphs are licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). The models were trained using the Rasa speech dataset by AI4Bharat; attribution to the model author and dataset is required. The ONNX Vocos vocoder weights are from charactr/vocos-mel-24khz and are licensed under MIT by their authors.

The Indic Tiny TTS model code is MIT licensed. This app uses the published ONNX graphs and a native Android ONNX Runtime inference implementation. It does not bundle model weights in the APK; users download language packs from the model repositories.

## ONNX Runtime

ONNX Runtime Android is distributed by Microsoft under its applicable open-source license. See https://github.com/microsoft/onnxruntime.

## Sherpa-ONNX

The Sherpa-ONNX Android runtime is used for offline speech recognition. See https://github.com/k2-fsa/sherpa-onnx and its license notices.


## Saient Wan2.1 Android video runtime

ChatWork packages the ARM64 Android Vulkan runtime `libquartz-wan.so` from the Saient project:

- Source project: https://github.com/SaientAI/saient
- Pinned source revision: `73073fd7fe17dc565b33a148e42282bcc1eb926c`
- Runtime artifact: `engine/arm64-v8a/libquartz-wan.so`
- Runtime SHA-256: `7f18eb1337e70bc69cbbd21adfe7a7bfe56401e50c33c7a41747104f6bfa49ca`
- Upstream backend: https://github.com/leejet/stable-diffusion.cpp
- Pinned backend revision: `e31a86ce9110b11a98bd5990c329093244c2d1e3`
- Backend license: MIT
- GGML revision: `eced84c86f8b012c752c016f7fe789adea168e1e`
- Saient Android progress patch: https://github.com/SaientAI/saient/blob/73073fd7fe17dc565b33a148e42282bcc1eb926c/engine/wan/saient-progress.patch

The backend is modified to emit newline-delimited generation progress and includes the documented mobile memory/quantization fixes. The runtime is downloaded during the Android build and verified against the pinned size and SHA-256 before packaging.

### MIT License

Copyright (c) 2023 leejet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Wan2.1 model weights

The separate model pack is based on Wan2.1 T2V 1.3B and is downloaded from the Saient model host. Model weights are not bundled in the APK. Review the upstream model card and license before redistribution:

https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B


## Kokoro-82M

ChatWork downloads the `kokoro_int8_fp16.litertlm` multilingual speech bundle from [litert-community/Kokoro-82M](https://huggingface.co/litert-community/Kokoro-82M). The model bundle is licensed under Apache-2.0. Android inference uses the MediaPipe Tasks Audio TextToSpeech API; MediaPipe Tasks are Apache-2.0. Retain upstream notices when redistributing.
