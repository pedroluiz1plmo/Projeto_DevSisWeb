# RPG Manager

Aplicação para organizar personagens, campanhas e atividades de mesas de RPG. O
projeto nasceu como trabalho acadêmico das disciplinas de Laboratório de
Engenharia de Software, Desenvolvimento de Sistemas Web e Desenvolvimento de
Sistemas para Dispositivos Móveis, no curso de Ciência da Computação da UNEMAT.

- **Profa:** Maricy Caregnato - [ Laboratório de Engenharia de Software]
- **Prof:** Marlon Vinicius da Silva - [Desenvolvimento de Sistemas Web e Desenvolvimento de Sistemas para Dispositivos Móveis]

- **Equipe:** Danny A. T. Scholze, Pedro L. M. de Oliveira, Lucas R. de B. Jardim,
Taíse A. de Miranda e Tássia B. Ferreira.

[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Flutter](https://img.shields.io/badge/Flutter-Dart%20%3E%3D%203.6.2-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

### Documentação do README do projeto Web e Mobile
> [Doc Web](./Projeto_DevSisWeb/README.md) <br>
> [Doc Mobile](./Projeto_DevSisMob/mobile/README.md)

## Índice

- [Visão geral](#visão-geral)
- [Arquitetura e estrutura](#arquitetura-e-estrutura)
- [Execução local com Docker](#execução-local-com-docker)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Vercel e PostgreSQL/Neon](#vercel-e-postgresqlneon)
- [Comunicação Web, Mobile e API](#comunicação-web-mobile-e-api)
- [Mobile: persistência e sincronização offline](#mobile-persistência-e-sincronização-offline)
- [Usuário Super Admin](#usuário-super-admin)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Execução do Flutter Desktop](#execução-do-flutter-desktop)
- [Testes e solução de problemas](#testes-e-solução-de-problemas)
- [O que precisa de confirmação externa](#o-que-precisa-de-confirmação-externa)

## Visão geral

O RPG Manager reúne ferramentas para jogadores e mestres, reduzindo o trabalho
manual de manter fichas, inventário, campanhas e informações da sessão.
Frontend Web e aplicativo Flutter utilizam a mesma API Node.js; o backend
persiste os dados compartilhados em PostgreSQL.

Entre os recursos implementados estão:

- Criação e edição de personagens, com fichas orientadas por sistema.
- Rolagens de dados, inventário e acompanhamento de atributos.
- Campanhas, participantes, convites, solicitações de entrada e QR Codes.
- Pastas, monstros, combate e controle de turnos/iniciativa.
- Notas e missões associadas opcionalmente a pastas e campanhas.
- Autenticação, workspaces de Jogador e Mestre e painel administrativo com
  permissões.
- Cache local e acesso offline com comportamentos diferentes no Web e no
  Mobile, descritos adiante.

O código do Web e os formulários/roladores Mobile contemplam **Dungeons &
Dragons 5ª edição**, **Call of Cthulhu 7ª edição** e **Vampiro: A Máscara V5**.
Isso não significa que todas as regras desses sistemas estejam automatizadas
em todos os recursos: por exemplo, a iniciativa de combate é manual e o
rolador Mobile não calcula perícias ou combinações de atributos que não estejam
estruturadas.

### Tecnologias

| Componente | Tecnologias confirmadas |
|---|---|
| Web | TypeScript, HTML, CSS, Vite, Mermaid e APIs do navegador |
| Backend | Node.js, módulos ES, HTTP, PostgreSQL (`pg`), JWT e bcrypt |
| Mobile | Flutter/Dart, HTTP, SQLite, SharedPreferences e armazenamento seguro |
| Execução local | Docker Compose; imagens Node 24 e Nginx |
| Hospedagem descrita/configurada | Configurações Vercel e conexão PostgreSQL por URL |

## Arquitetura e estrutura

```mermaid
flowchart LR
  WEB[Web: TypeScript + Vite] -->|HTTP/JSON, JWT| API[Backend: Node.js]
  MOBILE[Mobile/Desktop: Flutter] -->|HTTP/JSON, JWT| API
  API -->|pg Pool| DB[(PostgreSQL)]
  API -. conexão configurada externamente .-> NEON[(Neon, se DATABASE_URL apontar para Neon)]
```

- **Web**: interface e fluxos para jogadores e mestres. Seus serviços chamam
  `/api/...` e não acessam o banco diretamente.
- **Mobile**: cliente Flutter independente, com código em
  `Projeto_DevSisMob/mobile/`. Também consome a API; SQLite e preferências são
  armazenamento local, não uma conexão direta ao PostgreSQL.
- **Backend**: API REST Node.js em `Projeto_DevSisWeb/backend/`. As rotas
  encaminham operações para módulos, serviços e repositórios.
- **PostgreSQL**: armazenamento remoto do backend, configurado com
  `DATABASE_URL` ou parâmetros individuais de conexão. O código usa o driver
  `pg`; não inclui um servidor PostgreSQL no Docker Compose.
- **Vercel**: configurações de roteamento e execução estão presentes nos
  arquivos `vercel.json`. A escolha do projeto/domínio e as variáveis de
  produção são configurações externas ao repositório.

O backend valida JWTs, obtém a identidade do usuário da sessão e usa
`X-Workspace-Type` (`player` ou `master`) em operações que dependem do
workspace. O frontend e o Mobile enviam requisições HTTP/JSON para as mesmas
rotas; a API aplica escopo e autorização antes de persistir dados.

### Árvore resumida

```text
.
├── README.md
├── vercel.json
├── Projeto_DevSisWeb/
│   ├── docker-compose.yml
│   ├── package.json
│   ├── backend/
│   │   ├── dockerfile
│   │   ├── Dockerfile.vercel
│   │   ├── package.json
│   │   ├── vercel.json
│   │   ├── src/
│   │   │   ├── app.js, container.js
│   │   │   ├── config/, database/, middleware/, routes/, services/, cli/
│   │   │   └── modules/ (campanhas, personagens, notas, admin e outros)
│   │   └── test/
│   └── web/
│       ├── dockerfile
│       ├── Dockerfile.vercel
│       ├── package.json
│       ├── public/
│       └── src/
│           ├── main.ts, config/, models/, services/, views/
│           └── features/ (campanhas, fichas, administração e outros)
└── Projeto_DevSisMob/
    └── mobile/
        ├── pubspec.yaml
        ├── lib/
        │   ├── core/ (API e banco local)
        │   ├── models/, screens/, services/, widgets/
        ├── test/
        ├── android/, ios/, macos/, web/
        └── linux/, windows/
```

## Execução local com Docker

### Pré-requisitos

- Git.
- Docker Engine ou Docker Desktop com **Docker Compose v2** (`docker compose`).
- Uma conexão PostgreSQL acessível pelo backend. O Compose atual não inicia um
  banco local; pode-se configurar um PostgreSQL externo, inclusive Neon.

### Clonar e configurar

Na raiz em que deseja guardar o projeto:

```bash
git clone https://github.com/Datsc-21/Projeto_DevSisWeb.git
cd Projeto_DevSisWeb/Projeto_DevSisWeb
```

O Compose referencia `backend/.env` e esse arquivo é ignorado pelo Git. Não há
um `.env.example` verificado neste repositório. Se `backend/.env` ainda não
existir, crie-o localmente com as variáveis aplicáveis da seção
[Variáveis de ambiente](#variáveis-de-ambiente), por exemplo:

```dotenv
DATABASE_URL=postgresql://usuario:senha@host-exemplo/banco?sslmode=require
JWT_SECRET=<segredo-forte-e-exclusivo>
PORT=3000
```

Os valores acima são apenas formatos fictícios. Não copie credenciais reais
para o README, não as envie ao repositório e não use o marcador de segredo como
valor. Em alternativa a `DATABASE_URL`, o backend aceita `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER` e `DB_PASSWORD`. `PORT=3000` mantém o processo alinhado à
porta publicada pelo Compose.

### Construir, iniciar e acompanhar

```bash
# Construir as imagens e iniciar em primeiro plano
docker compose up --build

# Iniciar em segundo plano (depois que as imagens já foram construídas)
docker compose up -d

# Conferir estado e portas publicadas
docker compose ps

# Acompanhar todos os logs
docker compose logs -f

# Acompanhar um serviço específico
docker compose logs -f backend
docker compose logs -f frontend
```

O Compose inicia:

| Serviço | Porta local | URL |
|---|---:|---|
| Web (Vite) | `5173` | <http://localhost:5173> |
| Backend (Node.js) | `3000` | <http://localhost:3000> |

A API usa o prefixo `/api`; por exemplo, `GET http://localhost:3000/api/systems`
consulta os sistemas cadastrados. Essa rota depende de conexão e migrations
válidas no PostgreSQL.

O Compose não executa migrations automaticamente. Com o banco configurado,
aplique-as em outro terminal:

```bash
cd backend
npm install
npm run migrate
```

Para reiniciar serviços ou pará-los:

```bash
docker compose restart
docker compose down

# ATENÇÃO: também pode remover volumes e dados persistidos
docker compose down --volumes
```

Depois de alterar código ou arquivos usados na imagem, reconstrua e recrie os
serviços:

```bash
docker compose up --build -d
```

> **Atenção:** `docker compose down --volumes` também solicita a remoção dos
> volumes associados e pode apagar dados persistidos neles. O Compose atual não
> declara volumes nem um container PostgreSQL; mesmo assim, confira a
> configuração antes de usar essa opção. Ela não apaga diretamente um banco
> Neon/PostgreSQL externo.

## Variáveis de ambiente

Os valores abaixo foram conferidos no código/configuração. `DATABASE_URL` tem
precedência sobre as variáveis individuais de banco. A existência de um
`backend/.env` local ignorado pelo Git não torna seus valores parte da
documentação; nenhum valor real é reproduzido aqui.

| Variável | Componente | Finalidade | Obrigatória? | Exemplo fictício |
|---|---|---|---|---|
| `DATABASE_URL` | Backend | URL de conexão PostgreSQL; se definida, é usada pelo pool `pg`. | Sim para o banco, salvo uso do grupo `DB_*`. | `postgresql://user:pass@db.example.invalid/app?sslmode=require` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Backend | Alternativa à URL para configurar a conexão PostgreSQL. | Sim em conjunto quando `DATABASE_URL` não é definida. | `DB_HOST=db.example.invalid` |
| `DB_SSL` | Backend | Ativa SSL para conexão configurada pelas variáveis `DB_*` quando igual a `true`. | Não; padrão sem SSL nesse modo. | `DB_SSL=true` |
| `JWT_SECRET` | Backend | Chave usada para assinar/verificar tokens JWT. | Necessária para autenticação. | `<segredo-forte-e-exclusivo>` |
| `JWT_EXPIRES_IN` | Backend | Duração do JWT; o serviço usa `8h` quando omitida. | Não. | `12h` |
| `PORT` | Backend | Porta do servidor local; padrão `3000`. O Compose publica `3000:3000`. | Não; recomenda-se `3000` com o Compose. | `PORT=3000` |
| `VITE_API_URL` | Web | URL base do backend, sem credenciais. O código aceita e remove um sufixo `/api`; em desenvolvimento o padrão é `http://localhost:3000`, e em produção sem valor usa a origem do próprio Web. | Condicional: definir para usar backend em domínio separado. | `https://api.example.invalid` |
| `API_BASE_URL` | Mobile Flutter | URL base compilada com `--dart-define`; o cliente normaliza o sufixo para exatamente `/api`. | Não; padrão Android `10.0.2.2:3000/api`, demais alvos `localhost:3000/api`. | `https://api.example.invalid/api` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Backend | Acesso SMTP para recuperação de senha, suporte e notificações de e-mail. | Não para iniciar a API; necessário para envio de e-mail. | Valores fornecidos pelo serviço SMTP |
| `SMTP_SECURE` | Backend | Habilita conexão SMTP segura quando `true`. | Não; o código considera `false` se omitida. | `SMTP_SECURE=true` |
| `SMTP_FROM_NAME` | Backend | Nome exibido como remetente; padrão `Digital Master Shield`. | Não. | `RPG Manager` |
| `APP_BASE_URL` | Backend | URL pública usada em links de e-mail. | Não. | `https://app.example.invalid` |
| `SUPPORT_EMAIL` | Backend | Destinatário de suporte; o serviço tem um padrão quando omitida. | Não. | `suporte@example.invalid` |
| `PAYMENT_SIMULATOR_ENABLED` | Backend | Flag lida pelo simulador de pagamento, que também bloqueia execução em `NODE_ENV=production`. | Não; não representa integração com provedor real. | `false` |

`VITE_API_URL` é incorporada ao bundle Web e pode ser vista pelo navegador; nunca
a use para guardar segredos. JWT secret, senha do banco e credenciais SMTP
pertencem somente ao ambiente do backend.

## Vercel e PostgreSQL/Neon

### O que a configuração confirma

- A Vercel pode hospedar/rotear a aplicação conforme os arquivos
  `vercel.json`. A configuração da raiz declara serviços `frontend` e
  `backend`, encaminha `/api/...` ao backend e as demais rotas ao frontend.
- `backend/vercel.json` também define uma função Node para `src/app.js`.
  `backend/Dockerfile.vercel` configura o processo de container para escutar
  na porta `80`; `web/Dockerfile.vercel` constrói o bundle e o serve com Nginx.
- O backend cria um pool PostgreSQL com `pg`. Se `DATABASE_URL` estiver
  definida, ela é passada como `connectionString`; caso contrário, usa
  `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e, opcionalmente,
  `DB_SSL`.
- Não há SDK específico do Neon. O código conecta-se a PostgreSQL por URL; uma
  URL do Neon pode ser usada como `DATABASE_URL` se for configurada no ambiente
  do backend.

### Configuração operacional

No projeto/serviço Vercel que executa o backend, cadastre `DATABASE_URL`,
`JWT_SECRET` e as demais variáveis necessárias em **Settings → Environment
Variables**, para os ambientes Vercel apropriados. Não armazene os valores no
repositório e não os exponha ao bundle Web por `VITE_*`. Se o Web apontar para
um backend em domínio separado, configure `VITE_API_URL` no build do frontend
e publique um novo build depois de alterá-la. Quando a configuração de raiz
roteia `/api` ao backend no mesmo domínio, o padrão de produção do Web usa a
origem atual.

O deploy precisa disponibilizar o backend e suas variáveis, aplicar as
migrations no banco e disponibilizar o Web com uma URL de API coerente. O
repositório não determina quais projetos/domínios Vercel estão ativos nem se o
deploy é disparado por Git, CLI ou outro fluxo. Há configurações Vercel na raiz
e no backend, portanto confirme no painel qual configuração e diretório raiz
cada projeto usa.

Para verificar uma API publicada, substitua o domínio pelo endereço real:

```bash
curl -i https://<dominio-da-api>/api/systems
```

Uma resposta `200` com JSON confirma a rota e a consulta, desde que o banco
esteja configurado e as migrations aplicadas. Não foi encontrada uma rota
dedicada de health check. Uma resposta de erro de banco não deve ser
interpretada como confirmação de que o PostgreSQL está saudável.

## Comunicação Web, Mobile e API

### Web

`web/src/config/api.ts` lê `VITE_API_URL`. Em desenvolvimento, se a variável
estiver vazia, usa `http://localhost:3000`; no build de produção usa a origem
do Web. O módulo normaliza a URL e acrescenta `/api` para montar `API_BASE`.
URLs de produção precisam ser HTTPS; endereços locais são recusados no build
de produção.

Para apontar o Web local a outro backend, defina `VITE_API_URL` no ambiente
usado pelo Vite/build, por exemplo `https://api.example.invalid` (sem
credenciais). A configuração lê essa variável durante o build.

### Flutter Mobile

`ApiClient` recebe `API_BASE_URL` via `String.fromEnvironment` e normaliza o
caminho para conter `/api` uma única vez. Se não for informado, usa
`http://10.0.2.2:3000/api` no Android e `http://localhost:3000/api` nas demais
plataformas. O cliente centraliza as chamadas HTTP, JSON, timeout, token
Bearer e o cabeçalho `X-Workspace-Type`.

Para executar no emulador Android apontando ao backend local:

```bash
cd Projeto_DevSisMob/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```

Para gerar APK release apontando para a API real de produção:

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://SEU-DOMINIO.vercel.app/api
```

Substitua `SEU-DOMINIO` pelo domínio real da API. O exemplo não confirma que
esse domínio exista nem que `/api` esteja publicado nele.

### Endereços locais e produção

| Endereço | Significado |
|---|---|
| `localhost` | A própria máquina que executa o programa. No Flutter Desktop, é o computador; no Android Emulator, é o emulador, não o computador hospedeiro. |
| `10.0.2.2` | Endereço especial usado pelo Android Emulator para acessar o `localhost` do computador hospedeiro. |
| IP da rede local | Para um aparelho físico alcançar o backend no computador, use o endereço LAN do computador e permita o tráfego na rede/firewall. |
| URL HTTPS pública | Endereço do backend implantado, necessário em dispositivos externos e builds release que usam produção. |

Em ambos os clientes, a autenticação usa `Authorization: Bearer <JWT>` e o
workspace pode ser enviado em `X-Workspace-Type`. O Mobile guarda JWT em
`flutter_secure_storage`; não o coloca em SharedPreferences. Rotas públicas,
como login e cadastro, não exigem token. A API deriva a identidade do usuário
do token validado, em vez de confiar em um proprietário informado no payload.

## Mobile: persistência e sincronização offline

### Armazenamento local

O aplicativo usa:

- **SharedPreferences** para snapshots/cache JSON e preferências separadas por
  usuário e workspace.
- **SQLite** versionado para registros locais e operações da Outbox. A versão
  local atual do schema é 4; Linux e Windows usam `sqflite_common_ffi`.
- **`flutter_secure_storage`** para o JWT.

Consultas tentam a API primeiro; quando há falha de transporte, alguns recursos
podem exibir snapshots locais do mesmo usuário/workspace. Erros HTTP, como
`401` e `403`, não são tratados como falta de conexão. Escritas online só são
confirmadas na interface depois da resposta da API.

### O que já está implementado para notas e missões

Em notas e missões autenticadas, uma falha de transporte pode gravar a
alteração em `local_records` e inserir a operação correspondente na Outbox na
mesma transação SQLite. Há suporte local para `CREATE`, `UPDATE` e `DELETE`;
edições pendentes podem ser consolidadas, e excluir um registro cujo `CREATE`
ainda não foi enviado cancela as operações locais relacionadas. Isso não
significa que o backend já recebeu a alteração.

Os IDs locais são UUIDs. O `CREATE` inclui `clientId` na requisição; o backend
armazena esse identificador no escopo do usuário/workspace e trata repetições
de criação. Quando a resposta retorna o ID numérico remoto, o DAO atualiza o
vínculo no registro local e nas operações seguintes dentro de uma transação.
`UPDATE` e `DELETE` usam esse ID remoto.

`OutboxSyncService` implementa processadores para operações `CREATE`, `UPDATE`
e `DELETE` de notas e missões. O DAO reivindica operações pendentes com lease,
registra tentativas e falhas e permite re-enfileirar operações com falha.
Entretanto, **o serviço não está conectado ao ciclo de vida da aplicação nem
ao `ConnectionService`**: não há worker/chamada automática que consuma a fila,
nem retomada automática quando a conexão retorna. Assim, a persistência
offline está implementada, mas o envio automático e a sincronização completa
permanecem em desenvolvimento. A fila não cobre todas as entidades.

O `ConnectionService` observa a conectividade e verifica acesso à internet/API
para atualizar o indicador de estado. Ele não processa a Outbox. Não há
sincronização P2P, Bluetooth ou transferência direta entre aparelhos.

Na Web, o offline usa um cofre separado no IndexedDB: registros são protegidos
com AES-GCM e a chave local é protegida por derivação da senha. Desbloquear o
cofre não cria sessão/JWT nem habilita chamadas remotas; alterações locais
pendentes não devem ser descartadas antes de serem sincronizadas. Esse
mecanismo Web não é a Outbox SQLite do Flutter.

## Usuário Super Admin

O usuário é armazenado em `users` com nome, username, e-mail, `password_hash`
e estado `is_active`. A senha é armazenada como hash. Papéis de membros de
campanha (`campaign_members.role`) não equivalem a privilégios administrativos.

Não há um papel literal `super_admin`. O backend identifica administração por
permissões em `admin_permissions`; rotas verificam o JWT, a conta ativa e a
permissão exigida. O endpoint `GET /api/admin/me` retorna a identidade e as
permissões do usuário autenticado.

Há um procedimento implementado para provisionar o primeiro administrador:

1. Aplique as migrations e configure o ambiente do backend.
2. Crie uma conta pelo fluxo normal de cadastro e confirme que ela está ativa.
3. Use o ID numérico dessa conta no script do backend:

   ```bash
   cd Projeto_DevSisWeb/backend
   npm run admin:bootstrap -- --user-id <ID_NUMERICO> --reason "Provisionamento operacional inicial"
   ```

O comando exige usuário existente e ativo, concede as permissões conhecidas
pela aplicação e registra a ação na auditoria. Não altera permissões por uma
edição manual avulsa do banco. O script falha se os parâmetros estiverem
inválidos ou se a conta não existir/estiver bloqueada.

Para verificar a concessão, entre com essa conta e consulte
`GET /api/admin/me` usando o JWT da sessão, ou acesse o painel administrativo.
Um `403` indica que a chamada autenticada não tem a permissão necessária; um
`401` indica sessão inválida/ausente ou conta inativa.

## Banco de dados e migrations

O backend usa PostgreSQL com o cliente `pg`. As migrations SQL numeradas estão
em `Projeto_DevSisWeb/backend/src/database/migrations/`; o runner
`src/database/run.js` aplica os arquivos em ordem e registra os nomes já
executados em `schema_migrations`. O projeto contém migrations `001` a `025`.
Elas criam e evoluem, entre outras, tabelas de usuários, sistemas/versões,
personagens, campanhas/participantes, pastas, notas/missões, monstros, combate,
convites, permissões administrativas, planos, assinaturas e auditoria.

Para aplicar migrations, estando no diretório `backend/` e com a conexão
configurada:

```bash
npm install
npm run migrate
```

O runner precisa de acesso ao banco e termina com erro se uma migration falhar.
As migrations não são executadas pelo frontend nem automaticamente ao subir o
Compose. Faça backup e valide o ambiente antes de aplicar alterações em
produção.

Se `psql` estiver instalado e `DATABASE_URL` estiver configurada, uma consulta
de leitura pode confirmar a conexão e o controle de migrations:

```bash
psql "$DATABASE_URL" -c 'SELECT current_database(), current_user;'
psql "$DATABASE_URL" -c 'SELECT filename, applied_at FROM schema_migrations ORDER BY filename;'
```

Não compartilhe a URL impressa pelo ambiente nem use consultas de escrita em
produção sem procedimento de operação e backup.

## Execução do Flutter Desktop

Os diretórios `mobile/linux/` e `mobile/windows/` contêm runners e configuração
de plugins, portanto os alvos Desktop estão configurados no projeto. Para
executar com `flutter run`, **não é necessário gerar APK nem instalar Android
Studio**.

### Linux

1. Instale o Flutter SDK e adicione o comando `flutter` ao `PATH`. O Dart SDK
   correspondente é fornecido pelo Flutter; a restrição do projeto é Dart
   `>=3.6.2`.
2. Em distribuições Debian/Ubuntu, instale as ferramentas usadas pelo build
   Linux Desktop e a dependência do armazenamento seguro:

   ```bash
   sudo apt-get update
   sudo apt-get install clang cmake ninja-build pkg-config libgtk-3-dev libstdc++-12-dev libsecret-1-dev
   ```

3. Verifique o ambiente, habilite o alvo se necessário e confirme o dispositivo:

   ```bash
   flutter doctor
   flutter config --enable-linux-desktop
   flutter devices
   ```

4. Na raiz do repositório:

   ```bash
   cd Projeto_DevSisMob/mobile
   flutter pub get
   flutter run -d linux
   ```

Para passar uma API explícita no shell Linux:

```bash
flutter run -d linux \
  --dart-define=API_BASE_URL=http://localhost:3000/api
```

### Windows

1. Instale o Flutter SDK e configure o `PATH`.
2. Instale o **Visual Studio** (não apenas Visual Studio Code), incluindo a
   carga de trabalho **Desktop development with C++**, ferramentas C++,
   CMake e um Windows SDK compatível com o Flutter.
3. No PowerShell, confira e habilite o destino:

   ```powershell
   flutter doctor
   flutter config --enable-windows-desktop
   flutter devices
   ```

4. Da raiz do repositório, instale dependências e execute:

   ```powershell
   cd Projeto_DevSisMob\mobile
   flutter pub get
   flutter run -d windows
   ```

Para apontar para backend local:

```powershell
flutter run -d windows --dart-define="API_BASE_URL=http://localhost:3000/api"
```

Para usar produção, substitua o endereço por uma URL HTTPS real:

```powershell
flutter run -d windows --dart-define="API_BASE_URL=https://SEU-DOMINIO.vercel.app/api"
```

### Comparação dos alvos

| Sistema | Ferramentas principais | Execução | Observações |
|---|---|---|---|
| Linux | Flutter, clang, CMake, Ninja, GTK 3, `libsecret-1-dev` e ambiente gráfico. | `flutter run -d linux` | SQLite usa FFI. `flutter_secure_storage` requer suporte do sistema/Secret Service. |
| Windows | Flutter e Visual Studio com **Desktop development with C++**, CMake e Windows SDK. | `flutter run -d windows` | Não requer Android Studio para execução Desktop. |

`flutter run` compila e inicia uma versão de desenvolvimento para depuração; não
gera um instalador distribuível. Para criar artefatos release, os alvos
configurados aceitam `flutter build linux --release` e
`flutter build windows --release`.

Os plugins de câmera/leitura QR (`mobile_scanner`) e seleção de imagem
(`image_picker`) não aparecem nos registradores gerados de Linux/Windows.
Consequentemente, não conte com câmera/QR ou seleção de fotos nesses alvos.
Também há diferenças entre listas de plugins Desktop geradas por plataforma;
valide compartilhamento, conectividade e armazenamento seguro no sistema em
que o app será usado.

## Testes e solução de problemas

### Comandos de validação

Execute a partir da raiz do repositório, salvo indicação:

```bash
# Backend: testes Node.js
cd Projeto_DevSisWeb/backend
npm install
npm test

# Web: build de produção (o package.json não define script de teste Web)
cd ../web
npm install
npm run build

# Mobile Flutter
cd ../../Projeto_DevSisMob/mobile
flutter pub get
flutter analyze
flutter test
```

O build Web verifica TypeScript e gera o bundle Vite. Os testes Flutter usam
clientes simulados em vários casos; não substituem teste ponta a ponta com API
e PostgreSQL reais. O backend também requer variáveis e conexão configuradas
para operações que dependem do banco.

Para conferir Docker e uma rota de API local:

```bash
cd Projeto_DevSisWeb
docker compose ps
curl -i http://localhost:3000/api/systems
```

### Problemas comuns

| Sintoma | Causa provável | Verificação/solução |
|---|---|---|
| Compose informa que `backend/.env` não existe. | O `docker-compose.yml` declara esse arquivo como `env_file`; não há `.env.example` fornecido. | Crie `backend/.env` localmente com as variáveis necessárias; não coloque credenciais no Git. |
| Backend não inicia ou migrations falham com configuração incompleta. | `DATABASE_URL` não foi definida e faltam uma ou mais variáveis `DB_*`, ou o banco não está acessível. | Confira a URL/host, rede, usuário, senha e SSL aplicável; execute `npm run migrate` com o ambiente correto. |
| Cadastro/login falham ao assinar token. | `JWT_SECRET` ausente ou diferente entre instâncias/deploys. | Configure um segredo consistente no ambiente do backend; não o inclua no Web/Mobile. |
| Web não alcança a API. | `VITE_API_URL` aponta para o host/porta errados, ou o frontend foi compilado antes da mudança. | Em desenvolvimento confirme `http://localhost:3000`; em produção confirme HTTPS, domínio e novo build. |
| Flutter no Android tenta acessar o próprio emulador. | `localhost` não representa o computador hospedeiro no Android Emulator. | Use `--dart-define=API_BASE_URL=http://10.0.2.2:3000/api`. Para aparelho físico use o IP LAN do computador. |
| `/api/systems` retorna erro apesar de o servidor responder. | Banco desconectado, migrations ausentes ou tabela de sistemas não disponível. | Verifique logs do backend, conexão PostgreSQL e `npm run migrate`. |
| Endpoint administrativo responde `401` ou `403`. | Token ausente/inválido, conta inativa ou permissão não concedida. | Valide a sessão e, para provisionamento inicial, use `admin:bootstrap`; consulte `/api/admin/me`. |
| Flutter Desktop não compila/inicia. | Ferramentas Desktop ausentes, target desabilitado ou integração nativa do sistema indisponível. | Execute `flutter doctor`; no Linux instale as dependências listadas, e no Windows confira a carga C++ do Visual Studio. |
| Câmera/QR ou seleção de imagem não funciona no Desktop. | `mobile_scanner`/`image_picker` não têm plugin registrado nesses alvos. | Use Android/iOS ou Web compatível para esses recursos; a aplicação Desktop não inclui essas implementações. |
| Registros Mobile offline continuam pendentes depois de reconectar. | O worker da Outbox ainda não é iniciado automaticamente. | A operação local está preservada, mas o envio automático não está implementado/integrado nesta versão. |

## O que precisa de confirmação externa

- O código aceita PostgreSQL via `DATABASE_URL`, mas não comprova que o banco em
  produção seja Neon. Confirme no painel do provedor o host, TLS, backups e
  políticas de acesso; não copie a URL para documentação pública.
- Os arquivos Vercel descrevem mais de um arranjo possível (serviços em
  `vercel.json` da raiz e configurações individuais dos subprojetos). O
  repositório não revela quais projetos, Root Directories, domínios, variáveis
  ou gatilhos de deploy estão efetivamente configurados na conta Vercel.
- Não há `.env.example` versionado nem configuração de domínio de produção
  comprovada. Use o painel do deploy para verificar os valores e ambientes
  configurados, sem publicá-los.
- O processador da Outbox existe, mas o ciclo automático de envio e retomada
  após reconexão ainda precisa ser integrado e testado.
- Os plugins Desktop gerados não incluem todos os plugins Mobile. Confirme
  individualmente qualquer funcionalidade nativa que se pretenda disponibilizar
  em Linux ou Windows.

