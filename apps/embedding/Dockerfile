# syntax=docker/dockerfile:1

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models \
    HF_HUB_OFFLINE=0

WORKDIR /app

# 1. CPU 전용 torch 먼저 설치 (기본 휠은 CUDA 포함 → 이미지 수 GB 커짐)
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1

# 2. 나머지 파이썬 의존성
COPY requirements.txt .
RUN pip install -r requirements.txt

# 3. 모델을 이미지에 굽는다 (빌드 시 1회 다운로드).
#    - 컨테이너 기동이 즉시 (런타임 다운로드 대기 없음)
#    - 네트워크 없이도 동작, 빌드가 곧 재현 가능한 스냅샷
#    - 대가: 이미지가 ~475MB(roberta-base) 커짐
ARG MODEL_ID=BM-K/KoSimCSE-roberta-multitask
ENV MODEL_ID=${MODEL_ID}
RUN python -c "from transformers import AutoModel, AutoTokenizer; \
    AutoTokenizer.from_pretrained('${MODEL_ID}'); \
    AutoModel.from_pretrained('${MODEL_ID}')"

COPY app.py .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; \
    sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
