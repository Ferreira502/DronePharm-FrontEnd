# DronePharm-FrontEnd

Frontend modularizado em MVC com servidor local para:

- servir a interface no mesmo dominio do proxy
- ler tokens de variaveis de ambiente do sistema ou de um `.env` externo
- encaminhar requisicoes REST e WebSocket para o backend sem expor tokens na tela

## Como executar

1. Garanta que o backend DronePharm esteja rodando em `http://127.0.0.1:8000` ou defina `BACKEND_BASE_URL`.
2. Inicie o frontend com:

```bash
npm start
```

3. Abra:

```text
http://127.0.0.1:8080
```

Se quiser alterar a porta do frontend, defina `FRONTEND_PORT`.

## Configuracao

O servidor Node do frontend nao le mais o arquivo `.env` deste repositorio por padrao.

Use uma destas abordagens:

1. Variaveis de ambiente do sistema:

```powershell
$env:BACKEND_BASE_URL="http://127.0.0.1:8000"
$env:REST_WRITE_TOKEN="seu_token_rest"
$env:REST_ADMIN_TOKEN="seu_token_admin"
$env:REST_INGEST_TOKEN="seu_token_ingest"
$env:WS_TOKEN="seu_token_ws"
npm start
```

2. Arquivo `.env` externo:

```powershell
$env:FRONTEND_ENV_FILE="C:\Users\loona\Documents\DronePharm\.env"
npm start
```

Variaveis aceitas:

- `BACKEND_BASE_URL`
- `REST_WRITE_TOKEN`
- `REST_ADMIN_TOKEN`
- `REST_INGEST_TOKEN`
- `WS_TOKEN`
- `FRONTEND_HOST`
- `FRONTEND_PORT`
- `FRONTEND_REFRESH_INTERVAL_MS`

Precedencia:

- variaveis de ambiente do sistema
- arquivo apontado por `FRONTEND_ENV_FILE` ou `BACKEND_ENV_FILE`
