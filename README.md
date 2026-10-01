## Estrutura atual

O frontend web legado permanece na raiz para preservar o trabalho anterior. A nova etapa está separada em:

```text
frontend/  # Flutter: telas, navegação e serviços HTTP
backend/   # Node.js: API mock sem banco de dados
```

### Backend mock

```powershell
cd backend
npm start
```

Rotas: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout` e `GET /api/auth/me`.

### Frontend Flutter

Após instalar o Flutter SDK, execute:

```powershell
cd frontend
flutter pub get
flutter run
```

Para Android Emulator, informe `--dart-define=API_BASE_URL=http://10.0.2.2:3000/api`.

Não há PostgreSQL, tabelas, migrations ou persistência de credenciais nesta etapa.
