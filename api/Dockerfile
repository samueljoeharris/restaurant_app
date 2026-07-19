FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m app && chown -R app:app /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

USER app
EXPOSE 8080

CMD ["uvicorn", "ttf_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
