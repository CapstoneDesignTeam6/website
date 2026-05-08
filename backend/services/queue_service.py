"""
queue_service.py — Redis 큐 관리

백엔드가 에이전트에 작업을 위임하고 결과를 기다리는 방식:
  1. enqueue()   → Redis 리스트에 job 삽입
  2. wait_result() → result:{job_id} 키를 폴링하여 결과 반환
  워커는 큐에서 job을 꺼내 처리 후 result:{job_id}에 저장한다.
"""

import json
import os
import time
import uuid
from typing import Any

import redis

_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_RESULT_TTL = 300  # 5분

DISCUSSION_QUEUE = "queue:discussion"
EVALUATION_QUEUE = "queue:evaluation"


def _client() -> redis.Redis:
    return redis.from_url(_REDIS_URL, decode_responses=True)


def enqueue(queue: str, job_type: str, payload: dict) -> str:
    job_id = str(uuid.uuid4())
    job = {"job_id": job_id, "type": job_type, "payload": payload}
    _client().lpush(queue, json.dumps(job, ensure_ascii=False))
    return job_id


def wait_result(job_id: str, timeout: int = 90) -> Any:
    """결과가 나올 때까지 폴링. timeout 초 초과 시 TimeoutError."""
    r = _client()
    key = f"result:{job_id}"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        raw = r.get(key)
        if raw:
            r.delete(key)
            return json.loads(raw)
        time.sleep(0.3)
    raise TimeoutError(f"Job {job_id} timed out after {timeout}s")


def store_result(job_id: str, result: Any) -> None:
    """워커가 결과를 저장할 때 사용."""
    _client().setex(f"result:{job_id}", _RESULT_TTL, json.dumps(result, ensure_ascii=False))
