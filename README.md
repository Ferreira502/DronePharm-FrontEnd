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

## Especificacao tecnica para acompanhamento de pedidos em tempo real

### Objetivo

O usuario cria o pedido. A partir disso, o sistema gerencia automaticamente o ciclo de vida do pedido. Apenas duas acoes ficam manuais:

- cancelar
- entregue

### Estados do pedido

Fluxo sugerido:

- `pendente`: criado pelo usuario e aguardando processamento
- `calculado`: rota e drone definidos automaticamente
- `despachado`: missao iniciada
- `em_voo`: drone em deslocamento
- `entregue`: marcado manualmente pelo usuario
- `cancelado`: marcado manualmente pelo usuario
- `falha`: opcional para erro operacional

Regra:

- o frontend nao define estados automaticos
- o backend e o dono da maquina de estados
- o frontend so chama:
  - `POST /api/v1/pedidos/`
  - `PATCH /api/v1/pedidos/{id}/cancelar`
  - `PATCH /api/v1/pedidos/{id}/entregar`

### Plano backend

1. Maquina de estados

- Criar regra central de transicao de pedidos
- Permitir transicoes:
  - `pendente -> calculado`
  - `calculado -> despachado`
  - `despachado -> em_voo`
  - `em_voo -> entregue`
  - `pendente|calculado -> cancelado`
- Bloquear transicoes invalidas com `409`

2. Criacao do pedido

- `POST /api/v1/pedidos/`
- Salvar:
  - `id`
  - `descricao`
  - `prioridade`
  - `peso_kg`
  - `farmacia_id`
  - coordenadas de destino
  - `status = pendente`
  - `criado_em`
- Apos criar, disparar processamento assincrono para:
  - escolher drone elegivel
  - calcular rota
  - calcular ETA inicial
  - vincular `drone_id` e `rota_id`
  - mudar o pedido para `calculado`

3. Orquestracao automatica

- Worker ou servico de despacho monitora pedidos `calculado`
- Quando a missao iniciar:
  - `status = despachado`
  - `despachado_em`
- Quando houver movimento confirmado:
  - `status = em_voo`

4. Acoes manuais

- `PATCH /api/v1/pedidos/{id}/cancelar`
  - permitido so em estados configurados
  - remove rota ativa do mapa
  - libera drone se aplicavel
- `PATCH /api/v1/pedidos/{id}/entregar`
  - permitido so quando fizer sentido operacional
  - registra `entregue_em`
  - finaliza rota e missao
  - move pedido para historico

5. Snapshot do mapa

- `GET /api/v1/mapa/snapshot`
- Retornar apenas:
  - pedidos ativos
  - drones ativos
  - rotas ativas
- Nao incluir:
  - pedidos `cancelado`
  - pedidos `entregue`
  - rotas concluidas ou canceladas

6. Payload minimo para pedido ativo

- `id`
- `status`
- `descricao`
- `prioridade`
- `drone_id`
- `rota_id`
- `criado_em`
- `estimativa_entrega_em`
- `tempo_decorrido_seg`
- `tempo_restante_seg`
- `latitude_atual`
- `longitude_atual`
- `destino_latitude`
- `destino_longitude`

7. WebSockets e eventos

- Canal de eventos de pedido:
  - `pedido_criado`
  - `pedido_calculado`
  - `pedido_despachado`
  - `pedido_em_voo`
  - `pedido_cancelado`
  - `pedido_entregue`
- Canal de telemetria:
  - `pedido_id`
  - `drone_id`
  - `latitude`
  - `longitude`
  - `velocidade`
  - `bateria_pct`
  - `eta_seg`
  - `timestamp`

8. KPIs em tempo real

- Endpoint REST inicial e atualizacao por evento
- Metricas:
  - pedidos ativos
  - pedidos em voo
  - entregas concluidas
  - pontualidade
  - ETA medio
  - tempo medio em andamento

### Plano frontend

1. Regra de responsabilidade

- Usuario so:
  - cria pedido
  - cancela pedido
  - marca entregue
- Frontend nunca decide estado automatico

2. Pagina de pedidos

- Ao criar:
  - chamar `POST /api/v1/pedidos/`
  - mostrar novo pedido com `status = pendente`
- Tabela deve exibir:
  - ID
  - status
  - descricao
  - prioridade
  - drone vinculado
  - tempo decorrido
  - ETA
  - acoes
- Botoes:
  - `Cancelar`
  - `Entregue`

3. Mapa em tempo real

- Carregar snapshot inicial
- Assinar WebSocket de pedidos e telemetria
- Exibir apenas:
  - pedidos ativos
  - rotas ativas
  - drones em operacao
- Remover automaticamente do mapa quando status virar:
  - `cancelado`
  - `entregue`

4. Store local

- Criar store central para:
  - `pedidosAtivos`
  - `rotasAtivas`
  - `drones`
  - `kpis`
- Atualizar store por:
  - fetch inicial REST
  - eventos WebSocket
  - acoes do usuario

5. Tempo decorrido e ETA

- Backend envia timestamps e base de calculo
- Frontend roda timer local a cada segundo para atualizar:
  - tempo decorrido
  - ETA restante
- Sem precisar refazer fetch completo a cada segundo

6. Popup ou card do pedido no mapa

- Mostrar:
  - pedido
  - descricao
  - status
  - drone
  - coordenadas atuais
  - tempo decorrido
  - estimativa de entrega

7. Sincronizacao entre paginas

- Ao cancelar ou entregar:
  - atualizar store global
  - emitir evento interno
  - remover item do mapa
  - atualizar KPIs
  - atualizar tabela sem refresh manual

### Sequencia de implementacao

1. Backend: maquina de estados
2. Backend: criacao e processamento automatico
3. Backend: snapshot apenas com itens ativos
4. Backend: eventos WebSocket de pedido e telemetria
5. Frontend: store central
6. Frontend: mapa em tempo real
7. Frontend: KPIs em tempo real
8. Frontend: timer local de tempo decorrido e ETA

### Criterio de pronto

- Usuario cria pedido
- Backend automaticamente leva o pedido ate `em_voo`
- Mapa mostra ponto, rota e progresso
- KPIs atualizam sem refresh manual
- Tempo decorrido e ETA mudam em tempo real
- Apenas `cancelar` e `entregue` ficam manuais
