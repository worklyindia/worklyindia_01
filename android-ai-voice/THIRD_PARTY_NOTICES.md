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
