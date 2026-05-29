FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# langchain-tavily 0.1.5의 langchain-core 상한 메타데이터가 잘못됨 (실제론 1.x와 호환)
# --no-deps로 메타데이터 체크 우회해서 설치
RUN pip install --no-cache-dir --no-deps langchain-tavily==0.1.5

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
