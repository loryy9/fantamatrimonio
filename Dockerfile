FROM node:20-slim

WORKDIR /app

# 1. Installa dipendenze e compila il frontend Svelte
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 2. Installa dipendenze del backend (Worker Hono)
COPY worker/package*.json ./worker/
RUN cd worker && npm install

COPY worker/ ./worker/

# 3. Configurazione di rete e avvio
ENV PORT=8000
ENV NODE_ENV=production
EXPOSE 8000

# Volume per persistere le foto simulate localmente e lo stato
VOLUME ["/app/worker/.wrangler"]

WORKDIR /app/worker

# Avvio del server su tutte le interfacce per renderlo accessibile a Dokploy / Docker
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8000", "--show-interactive-dev-session=false"]
