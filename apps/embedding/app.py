"""KoSimCSE 임베딩 서비스.

한국어 문장 임베딩(BM-K/KoSimCSE-roberta-multitask, 768차원)을 HTTP 로 제공한다.
- CLS 풀링 + L2 정규화 (모델 카드 기준 방식). 정규화하면 pgvector 의 코사인 거리(`<=>`)와
  내적(`<#>`) 어느 쪽으로 검색해도 결과가 일치한다.
- api 서버(NestJS)의 재임베딩 스크립트 / 질의 시점 임베딩이 이 서비스를 호출한다.
"""

import os
from contextlib import asynccontextmanager

import torch
import torch.nn.functional as F
from fastapi import FastAPI
from pydantic import BaseModel, Field
from transformers import AutoModel, AutoTokenizer

MODEL_ID = os.getenv("MODEL_ID", "BM-K/KoSimCSE-roberta-multitask")
MAX_BATCH = int(os.getenv("MAX_BATCH", "256"))      # 요청 1건 내부에서 나눠 처리할 배치 크기
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "128"))    # 카톡 초단문 위주라 128 이면 충분

_state: dict = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID)
    model.eval()
    torch.set_grad_enabled(False)
    _state["tokenizer"] = tokenizer
    _state["model"] = model
    _state["dim"] = model.config.hidden_size
    yield
    _state.clear()


app = FastAPI(title="KoSimCSE Embedding Service", version="1.0.0", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1)


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dim: int


@app.get("/health")
def health():
    return {
        "status": "ok" if "model" in _state else "loading",
        "model": MODEL_ID,
        "dim": _state.get("dim"),
    }


def _embed(texts: list[str]) -> list[list[float]]:
    tokenizer = _state["tokenizer"]
    model = _state["model"]
    out: list[list[float]] = []
    for i in range(0, len(texts), MAX_BATCH):
        # 빈 문자열은 토크나이저가 싫어하므로 공백 한 칸으로 치환
        batch = [t if t and t.strip() else " " for t in texts[i : i + MAX_BATCH]]
        enc = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        hidden = model(**enc).last_hidden_state   # [B, T, H]
        cls = hidden[:, 0]                        # CLS 풀링 → [B, H]
        cls = F.normalize(cls, p=2, dim=1)        # 단위 벡터로 정규화
        out.extend(cls.tolist())
    return out


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    return {"embeddings": _embed(req.texts), "model": MODEL_ID, "dim": _state["dim"]}
