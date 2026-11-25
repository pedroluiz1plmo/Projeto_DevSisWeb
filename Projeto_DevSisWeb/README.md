# RPG Manager — Plataforma Web

[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pg-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

Plataforma web para organizar jogos de RPG. Oferece áreas de jogador e mestre, fichas de personagem, campanhas, convites, combate por iniciativa, monstros, notas, missões, sistemas de RPG, amizades, planos e administração. A SPA consome uma API HTTP própria e persiste dados em PostgreSQL.

Este documento cobre apenas `web/` e `backend/`. O mobile pode consumir a mesma API, mas não é detalhado aqui.

> Para arquitetura geral, Docker e configuração do backend, consulte o
> [README principal](../../README.md).

## Índice

- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura](#estrutura)
- [Configuração](#configuração-do-ambiente)
- [Execução local](#execução-local-sem-docker)
- [Docker](#docker-compose)
- [Banco e Neon](#banco-de-dados-e-neon)
- [Autenticação](#autenticação-e-acesso)
- [API](#api-http)
- [Frontend e API](#integração-frontend--api)
- [Vercel](#deploy-na-vercel)
- [Manutenção](#testes-e-manutenção)
- [Problemas comuns](#solução-de-problemas)

## Arquitetura

```mermaid
flowchart LR
  W[Navegador\nSPA Vite + TypeScript] -->|fetch /api\nBearer JWT| A[API Node.js]
  A -->|pg| D[(PostgreSQL / Neon)]
  A -->|SMTP quando configurado| M[Servidor de e-mail]
  V[Vercel] -->|/api/*| A
  V -->|demais rotas| W
```

- **Frontend:** SPA TypeScript construída com Vite. Telas, módulos e serviços ficam em `web/src`; há IndexedDB e cofre local criptografado para dados locais.
- **Backend:** servidor HTTP nativo Node.js em `backend/src/app.js`, com JSON, CORS, despacho de módulos e handler compatível com Vercel.
- **Banco:** PostgreSQL via `pg`, com pool de até cinco conexões e migrações SQL incrementais.
- **Autenticação:** JWT assinado pelo backend. Clientes usam `Authorization: Bearer <token>`; recursos de workspace aceitam `X-Workspace-Type: player|master`.
- **Hospedagem:** `vercel.json` define serviços de frontend e backend; `/api/*` vai à API e o restante à SPA.

## Tecnologias

| Camada | Tecnologia confirmada | Papel |
|---|---|---|
| Frontend | TypeScript `~6.0.2`, HTML, CSS | Interface no navegador. |
| Build | Vite `^8.2.0` | Desenvolvimento e build da SPA. |
| Recursos | `html5-qrcode`, `qrcode`, Mermaid | QR Code e diagramas na interface. |
| Backend | Node.js 24, JavaScript ESM | API e regras de negócio. |
| Segurança | `bcrypt` `^6.0.0`, `jsonwebtoken` `^9.0.3` | Senhas e JWT. |
| Dados | PostgreSQL, `pg` `^8.23.0` | Persistência relacional. |
| E-mail | `nodemailer` `^10.3.1` | E-mails de boas-vindas, recuperação e notificações. |
| Infra | Docker Compose, Nginx, Vercel | Contêineres, serviço estático e deploy. |

## Estrutura

```text
Projeto_DevSisWeb/
├── backend/
│   ├── api/[...path].js            # entrada serverless
│   ├── src/
│   │   ├── app.js                  # servidor e despacho de rotas
│   │   ├── config/database.js      # pool PostgreSQL
│   │   ├── database/migrations/    # migrações 001 a 025
│   │   ├── middleware/auth.js      # JWT e workspace
│   │   ├── modules/                # domínios da API
│   │   └── cli/bootstrap_admin.js  # permissões administrativas
│   ├── test/
│   └── package.json
├── web/
│   ├── src/config/api.ts           # URL base da API
│   ├── src/features/               # módulos e serviços
│   ├── src/views/                  # telas principais
│   ├── Dockerfile.vercel
│   └── package.json
├── docker-compose.yml
├── package.json
└── vercel.json
```

## Pré-requisitos

- Git;
- Node.js 24 recomendado (os Dockerfiles usam `node:24-alpine`/`node:24-slim`) e npm;
- acesso a PostgreSQL; Neon é aceito por string de conexão;
- Docker Desktop e Docker Compose, para a execução em contêineres.

## Configuração do ambiente

O backend lê `backend/.env` via `dotenv`. Não há `.env.example` nem variável de frontend versionada; crie `web/.env` somente para sobrescrever a URL padrão da API.

```dotenv
# backend/.env — use DATABASE_URL OU todas as DB_*
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/BANCO?sslmode=require
JWT_SECRET=use-um-segredo-longo-e-aleatorio
JWT_EXPIRES_IN=8h
PORT=3000

# Necessárias para e-mail/recuperação de senha
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASSWORD=senha-ou-app-password
SMTP_FROM=RPG Manager <no-reply@exemplo.com>
SMTP_FROM_NAME=RPG Manager
APP_BASE_URL=http://localhost:5173
SUPPORT_EMAIL=suporte@exemplo.com
```

```dotenv
# web/.env — opcional; em desenvolvimento o padrão é http://localhost:3000
VITE_API_URL=http://localhost:3000
```

| Variável | Componente | Finalidade |
|---|---|---|
| `DATABASE_URL` | backend | String PostgreSQL; caminho preferencial para Neon. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` | backend | Alternativa à URL única; os cinco primeiros são obrigatórios nesse modo. |
| `PORT` | backend | Porta local; padrão `3000`. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | backend | Segredo obrigatório e validade do JWT (padrão `8h`). |
| `SMTP_*`, `SMTP_FROM`, `SMTP_FROM_NAME` | backend | Transporte/remetente de e-mail. Sem SMTP, recuperação de senha fica indisponível. |
| `APP_BASE_URL`, `SUPPORT_EMAIL` | backend | Links de e-mail e suporte. |
| `PAYMENT_SIMULATOR_ENABLED` | backend | Controle do simulador de pagamento. |
| `VITE_API_URL` | frontend | URL base HTTP(S), sem query/hash. Em produção deve ser HTTPS e não-local. |

`NODE_ENV` e `VERCEL` também são lidas em execução. Não versione segredos, senhas SMTP nem URL privada do banco.

## Execução local sem Docker

Na raiz, instale ambos os projetos:

```bash
npm run install:all
```

1. Configure `backend/.env` e aplique a estrutura do banco:

   ```bash
   cd backend
   npm run migrate
   npm run dev
   ```

   A API usa `http://localhost:3000` por padrão. Use `npm start` para executá-la sem observação de arquivos.

2. Em outro terminal, suba a SPA:

   ```bash
   cd web
   npm run dev
   ```

   O Vite anuncia a URL no terminal; em geral é `http://localhost:5173`. Caso esteja ocupada, use a URL de fato informada pelo Vite.

3. Abra a SPA e registre uma conta, ou teste a API:

   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Ana","username":"ana.rpg","email":"ana@example.test","password":"senha-segura"}'
   ```

Uma resposta `201` com `success`, `user` e `token` confirma o backend e o banco.

## Docker Compose

O compose contém `backend` e `frontend`; **não contém PostgreSQL**. Assim, `backend/.env` deve apontar a um banco acessível pelo contêiner. Os serviços são publicados em `http://localhost:3000` e `http://localhost:5173`.

```bash
docker compose up --build       # constrói imagens e acompanha logs
docker compose up -d            # inicia em segundo plano
docker compose ps               # estado e portas
docker compose logs -f          # logs de todos os serviços
docker compose logs -f backend  # logs da API
docker compose logs -f frontend # logs da SPA
docker compose restart          # reinicia os serviços
docker compose down             # para e remove containers/rede
```

Após editar Dockerfiles, dependências ou código que será copiado para a imagem, rode `docker compose up --build` novamente.

> **Atenção:** hoje o compose não declara volumes nomeados. Ainda assim, não use `docker compose down -v` sem revisar o ambiente: a opção remove volumes associados e pode apagar dados persistidos por serviços adicionados no futuro.

## Banco de dados e Neon

`backend/src/config/database.js` cria o pool PostgreSQL. Se `DATABASE_URL` estiver presente, a aplicação a usa diretamente — o código identifica esse caminho como conexão Neon. Caso contrário, exige `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`; `DB_SSL=true` habilita SSL.

As migrações em `backend/src/database/migrations/` vão de `001_create_users.sql` a `025_allow_early_free_trial_cancellation.sql`. `npm run migrate` registra arquivos em `schema_migrations` e aplica somente os pendentes, cada um em transação.

O esquema cobre usuários, sistemas/versões, personagens e fichas D&D 5e, campanhas/membros/vínculos, pastas, notas/missões, monstros, convites, combates, amizades, planos/assinaturas/pagamentos/despesas e auditoria administrativa. Para testar conexão sem dados de exemplo, execute `npm run migrate`; uma configuração válida termina sem erro.

Use banco separado em desenvolvimento e faça backup/revisão antes de rodar migrações contra produção. Não há dados versionados sobre projeto, região, branch ou credenciais Neon; somente o suporte a `DATABASE_URL` foi confirmado.

## Autenticação e acesso

- `POST /api/auth/register` cria conta com senha de pelo menos 8 caracteres, hash bcrypt (custo 12) e JWT.
- `POST /api/auth/login` recebe `identifier` (usuário/e-mail) e `password`; contas inativas não autenticam.
- `POST /api/auth/password-recovery` e `/confirm` existem. Tokens são aleatórios, salvos como SHA-256, expiram em 30 minutos e têm limite de tentativas; SMTP é necessário.
- O middleware interpreta `Authorization: Bearer <JWT>`. Rotas protegidas verificam token e a aplicação confere se a conta continua ativa.
- O header `X-Workspace-Type` aceita somente `player` ou `master`.
- A administração é baseada em permissões na tabela `admin_permissions`; as ações ficam auditadas.

Para dar todas as permissões administrativas a uma conta ativa já existente:

```bash
cd backend
npm run admin:bootstrap -- --user-id 123 --reason "Provisionamento inicial autorizado"
```

O comando exige ID numérico e motivo; não cria usuários nem desbloqueia contas. Não há uma entidade “Super Admin” distinta no código: esse procedimento concede o conjunto atual de permissões administrativas ao usuário indicado.

## API HTTP

As rotas começam em `/api`. Exceto onde indicado, use `Authorization: Bearer <token>`.

| Módulo | Rotas e operações | Acesso |
|---|---|---|
| Autenticação | `POST /auth/register`, `/login`, `/password-recovery`, `/password-recovery/confirm`, `/logout`; `GET /auth/me` | Públicas, exceto `/me`. |
| Perfil | `GET /users/search?username=`; `PUT|DELETE /users/me`; `PUT /users/me/password` | JWT. |
| Personagens | `GET|POST /characters`; `GET|PUT|DELETE /characters/:id`; CRUD de `/characters/:id/dnd-5e` | JWT e workspace quando aplicável. |
| Campanhas | `GET|POST /campaigns`, membros, personagens vinculados, solicitações e dashboard do mestre | JWT; serviço valida membro/mestre. |
| Convites | preview, pedidos de entrada, código de convite, convites diretos e respostas | Preview por `POST`; demais conforme usuário/campanha. |
| Combate/monstros | `/campaigns/:id/combats`, `/combats/:id/*`, `/campaigns/:id/monsters` | JWT e acesso à campanha. |
| Conteúdo | CRUD de `/folders`, `/notes`, `/missions` | JWT. |
| Sistemas | `GET /systems`, `/systems/:id`, `/systems/:id/versions`, `/system-versions/:id` | Leitura pública no roteador atual. |
| Social/suporte | `/friendships*`, `POST /support/tickets` | Amizades com JWT; ticket de suporte. |
| Planos | `/plans`, `/subscriptions/*`, `/free-trial/*`, `/payment-simulator/*` | Consulta de planos pública; demais conforme rota. |
| Administração | `/admin/me`, dashboard, usuários, permissões, planos, sistemas, assinaturas, pagamentos, despesas, relatórios, auditoria e configurações | JWT + permissão específica. |

Exemplo de login:

```http
POST /api/auth/login
Content-Type: application/json

{"identifier":"ana.rpg","password":"senha-segura"}
```

```json
{
  "success": true,
  "user": { "id": 42, "name": "Ana", "username": "ana.rpg", "email": "ana@example.test" },
  "token": "<jwt>"
}
```

Consulte `*.routes.js` e seus controllers/services em `backend/src/modules/` para corpo, validações e respostas de cada endpoint: eles são o contrato implementado.

## Integração frontend ↔ API

`web/src/config/api.ts` calcula `API_BASE` como `${VITE_API_URL}/api`. Sem `VITE_API_URL`, em desenvolvimento usa `http://localhost:3000`; em produção usa `window.location.origin`, compatível com os rewrites da Vercel.

Serviços em `web/src/features/*/services/` usam `fetch`, adicionam token e convertem erros HTTP em mensagens para a interface. Exemplo equivalente ao `CharacterService`:

```ts
await fetch(`${API_BASE}/characters`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Workspace-Type': 'player',
  },
});
```

Há serviços separados para campanhas, personagens, pastas, notas/missões, planos, amizades, sistemas e administração. O token é usado na sessão do cliente e descartado pelo logout.

## Deploy na Vercel

O `vercel.json` raiz declara:

- `frontend`: raiz `web/`, contêiner `web/Dockerfile.vercel`, que gera a SPA Vite e a serve por Nginx;
- `backend`: raiz `backend/`, contêiner `backend/Dockerfile.vercel`;
- rewrite `/api/(.*)` para backend e `/(.*)` para frontend.

O backend também possui `backend/vercel.json`, que expõe `src/app.js` com `@vercel/node`, e `api/[...path].js` que encaminha caminhos ao mesmo handler.

Na Vercel, configure no mínimo `DATABASE_URL` e `JWT_SECRET`; inclua SMTP para recuperação/e-mails. Configure `VITE_API_URL` somente se API e frontend não compartilharem a origem HTTPS. Publique pelo fluxo do projeto e valide a SPA, `POST /api/auth/login`, `GET /api/auth/me` autenticado e os logs de runtime.

O repositório não contém a conta, domínio, URL pública, projeto Neon ou estado de deploy da Vercel; esses pontos não podem ser confirmados localmente.

## Testes e manutenção

```bash
# frontend: TypeScript e build de produção
cd web
npm run build
npm run preview

# backend: testes e migrações
cd ../backend
npm test
npm run migrate
```

Na raiz, `npm run build` compila o frontend; `npm run dev` inicia somente o frontend; `npm run dev:backend` inicia somente a API. Em Docker, use `docker compose logs -f backend` ou `docker compose logs -f frontend`.

## Solução de problemas

| Sintoma | Possível causa | Solução |
|---|---|---|
| Porta 3000/5173 ocupada | Outro processo escuta a porta. | Pare-o, altere `PORT` e ajuste `VITE_API_URL`; no Vite, siga a URL anunciada. |
| SPA não alcança API | API parada ou URL base incorreta. | Inicie backend e revise `VITE_API_URL`. |
| Configuração de banco incompleta | Ausência de `DATABASE_URL` e de alguma `DB_*`. | Use URL única ou informe todas as variáveis individuais. |
| Erro TLS/Neon | SSL/string de conexão inadequada. | Prefira a `DATABASE_URL` fornecida; no modo individual, avalie `DB_SSL=true`. |
| Recuperação indisponível | SMTP ausente. | Configure `SMTP_HOST`, porta, credenciais e remetente. |
| `401` em rota privada | Token ausente/expirado ou usuário bloqueado. | Faça login de novo e envie o bearer token. |
| Build Vite falha | TypeScript ou dependências. | Rode `npm install` em `web/` e depois `npm run build`. |
| Docker falha | `.env` ausente, banco inacessível ou porta ocupada. | Revise `.env`, `docker compose ps` e logs do backend. |
| Vercel retorna 5xx | Variáveis, build ou banco de produção ausentes. | Confira logs, `DATABASE_URL` e `JWT_SECRET` na Vercel. |

## Limites confirmados

- Não foi identificado endpoint de health check; valide com registro/login ou outra rota real.
- Não há `.env.example`, `.nvmrc`, CI, domínio ou URL pública versionados.
- Neon é suportado por `DATABASE_URL`, mas o repositório não contém sua configuração de infraestrutura.
- Os arquivos de Vercel existem, mas não permitem provar que há um deploy ativo.
