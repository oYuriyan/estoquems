FROM python:3.12-slim

ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/oYuriyan/estoquems" \
      org.opencontainers.image.revision=$VCS_REF

# Variáveis de ambiente do Python — evita .pyc e buffer de stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências do sistema (necessário para asyncpg/bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependências Python primeiro (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY . .

# Usuário não-root por segurança
RUN adduser --disabled-password --gecos '' appuser
USER appuser

# Expõe a porta interna (não publicada diretamente — via nginx)
EXPOSE 8000

# Comando de inicialização
# --workers 1: single worker para evitar conflito de migration no startup
# A migração é executada pelo entrypoint antes do uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips=\"*\""]
