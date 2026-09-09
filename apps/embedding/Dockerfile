# syntax=docker/dockerfile:1

# 베이스 이미지는 digest 로 고정 (몇 달 뒤 재배포해도 동일 빌드).
#   태그 → digest 갱신: docker manifest inspect python:3.11-slim
#   고정 시각: 2026-09-09  (python:3.11-slim, 멀티아치 인덱스 digest)
FROM python:3.11-slim@sha256:9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534

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
