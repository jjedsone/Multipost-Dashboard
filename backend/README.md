## Backend Multipost

Servidor Express simples para enviar mídia + legenda/tags para YouTube, Instagram (Graph API) e TikTok. O upload completo para YouTube está implementado; Instagram e TikTok possuem stubs e instruções no próprio código para você complementar com suas credenciais/infra.

### Pré-requisitos

- Node.js >= 18
- Conta Google com acesso à YouTube Data API v3
- Página do Facebook e conta Instagram profissional, se for usar Instagram Graph API
- Conta TikTok for Developers

### Instalação

```bash
cd backend
npm install
cp .env.example .env
```

Preencha o arquivo `.env` com suas credenciais. Veja a seção abaixo sobre YouTube para gerar o `YT_REFRESH_TOKEN`.

### Gerando refresh token do YouTube

1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com/).
2. Ative a API `YouTube Data API v3`.
3. Em **APIs e serviços > Credenciais**, crie um **ID do cliente OAuth** (tipo *Aplicativo para computador* ou *Aplicação Web* com redirect `http://localhost:4000/oauth2callback`).
4. Copie `YT_CLIENT_ID`, `YT_CLIENT_SECRET` e `YT_REDIRECT_URI` para `.env`.
5. Execute:
   ```bash
   node oauth_helpers.js
   ```
6. O script imprime a URL de autorização. Abra, faça login, copie o `code` e cole no terminal.
7. O helper grava o `YT_REFRESH_TOKEN` no seu `.env`.

### Executando o servidor

```bash
npm run dev
# ou
npm start
```

Endpoints:

- `GET /health`: retorna status simples para teste.
- `POST /post`: recebe `multipart/form-data` com os campos:
  - `media` (arquivo, obrigatório)
  - `caption` (texto opcional)
  - `title` (texto opcional, usado no YouTube)
  - `tags` (string separada por vírgula)
  - `platforms` (múltiplos valores com nomes: `youtube`, `instagram`, `tiktok`)

### Estrutura dos serviços

- `services/youtube.js`: Upload via `googleapis` usando refresh token.
- `services/instagram.js`: Stub com instruções do Graph API (requer hospedar mídia em URL pública).
- `services/tiktok.js`: Stub com notas para o fluxo de upload do TikTok for Developers.

### Conectando Instagram pelo painel

1. No frontend, clique em **Conectar Instagram**.
2. Faça login via Facebook e selecione a página vinculada ao perfil Instagram profissional.
3. Após autorizar, o backend salva o token longo da página em `backend/tokens/instagram.json`.
4. O endpoint `/auth/instagram/status` expõe a página conectada; o botão do painel atualiza automaticamente.

Se preferir configurar manualmente, defina `FB_PAGE_ACCESS_TOKEN` e `IG_USER_ID` no `.env`. O código dá prioridade aos valores do arquivo de tokens.

### Uploads temporários

Os arquivos recebidos ficam em `backend/tmp/` durante o processamento e são removidos ao final da requisição. Para produção, considere mover esse fluxo para armazenamento persistente (S3, GCS, etc.).

### Boas práticas

- Nunca commit suas credenciais `.env`.
- Adicione logs e tratativas de erro conforme sua necessidade (retry/backoff).
- Use armazenamento seguro para tokens em produção.

