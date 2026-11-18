FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential libsndfile1 && rm -rf /var/lib/apt/lists/*
RUN pip install --upgrade pip huggingface_hub
RUN hf download Oomni/mithi-v2-flash --local-dir /app/model
WORKDIR /app/model
RUN pip install -r /dev/null || true
RUN pip install "torch>=2.4" "transformers>=5.0" "safetensors>=0.4" "sentencepiece>=0.2" "numpy>=1.26" "soundfile>=0.12" "misaki[en]>=0.9.4" "espeakng-loader>=0.2.4" "phonemizer-fork>=3.3.2" "spacy>=3.8" "num2words>=0.5"
RUN python -m spacy download en_core_web_sm
COPY main.py /app/main.py
ENV PYTHONPATH=/app/model
WORKDIR /app
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
