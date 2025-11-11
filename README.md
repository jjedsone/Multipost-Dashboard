<div align="center">

# Multipost Dashboard

Painel local (React + Node.js) para publicar conteúdo simultaneamente em YouTube, Instagram (Graph API) e TikTok.

</div>

---

## Recursos principais

- **Upload YouTube** 100% funcional com `refresh_token` reutilizável.
- **Instagram OAuth** integrado: conecte sua página via popup e armazene tokens localmente.
- **TikTok** com fluxo estruturado e pontos de extensão para upload oficial.
- Painel React rápido (Vite) com formulário único para mídia, legenda, tags e seleção de plataformas.
- Cartões com status em tempo real de YouTube, Instagram e TikTok (checagem/atualização direto do painel).
- Lint configurado (ESLint + Prettier) tanto no backend quanto no frontend.

## Estrutura do projeto

```
multipost/
├─ backend/
│  ├─ server.js
│  ├─ oauth_helpers.js
│  ├─ services/
│  │  ├─ youtube.js
│  │  ├─ instagram.js
│  │  ├─ instagramAuth.js
│  │  └─ tiktok.js
│  ├─ tokens/           # tokens persistidos (gitignored)
│  ├─ tmp/              # uploads temporários (gitignored)
│  ├─ package.json
│  └─ .env.example
├─ frontend/
│  ├─ src/
│  │  ├─ main.jsx
│  │  ├─ App.jsx
│  │  └─ components/PostForm.jsx
│  ├─ vite.config.js
│  ├─ eslint.config.js
│  ├─ package.json
│  └─ .env.example
└─ README.md
```

## Pré-requisitos

- Node.js 18 ou superior.
- Contas e apps configurados em:
  - **Google Cloud Console** (YouTube Data API v3).
  - **Facebook Developers** (Instagram Graph API com página vinculada).
  - **TikTok for Developers** (Content Posting).
- Armazenamento público (ex.: S3, Cloudinary) para hospedar mídia antes do publish do Instagram.

## Instalação

```bash
# Backend
cd backend
npm install
cp .env.example .env

# Frontend
cd ../frontend
npm install
cp .env.example .env
```

## Variáveis de ambiente (backend)

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta da API (default 4000). |
| `YT_CLIENT_ID` / `YT_CLIENT_SECRET` | Credenciais OAuth do Google. |
| `YT_REDIRECT_URI` | Deve ser `http://localhost:4000/oauth2callback` ao gerar tokens. |
| `YT_REFRESH_TOKEN` | Refresh token obtido via `oauth_helpers.js`. |
| `FB_APP_ID` / `FB_APP_SECRET` | Credenciais do app Facebook (usadas no fluxo OAuth). |
| `FB_REDIRECT_URI` | `http://localhost:4000/auth/instagram/callback` em dev. |
| `FB_PAGE_ACCESS_TOKEN` / `IG_USER_ID` | Preencher manualmente ou deixar vazio para que o fluxo OAuth gere automaticamente. |
| `TT_CLIENT_KEY` / `TT_CLIENT_SECRET` | Credenciais do app TikTok. |
| `TT_REDIRECT_URI` | `http://localhost:4000/tiktok/callback` em dev. |
| `TT_REFRESH_TOKEN` | Refresh token do TikTok. |
| `MAX_UPLOAD_SIZE_MB` | Tamanho máximo do arquivo enviado (padrão 512 MB). |

## Fluxo de autenticação Instagram pelo painel

1. No frontend, clique em **Conectar Instagram**.
2. Faça login com sua conta Facebook e escolha a página vinculada ao perfil Instagram profissional.
3. Após autorizar, o backend troca o `code` por token de longa duração e salva em `backend/tokens/instagram.json`.
4. O painel atualiza o status automaticamente. Caso prefira, ainda é possível definir `FB_PAGE_ACCESS_TOKEN` e `IG_USER_ID` manualmente no `.env`.

## Gerando refresh token do YouTube

1. Ative a API `YouTube Data API v3` no Google Cloud Console.
2. Crie credenciais OAuth (tipo Desktop ou Web) com redirect `http://localhost:4000/oauth2callback`.
3. Preencha `.env` com `YT_CLIENT_ID`, `YT_CLIENT_SECRET` e `YT_REDIRECT_URI`.
4. Execute no backend:

   ```bash
   node oauth_helpers.js
   ```

5. Abra a URL gerada, autorize e cole o `code` no terminal. O script grava `YT_REFRESH_TOKEN` no `.env`.

## Rodando em desenvolvimento

```bash
# Backend
cd backend
npm run dev

# Frontend (outro terminal)
cd frontend
npm run dev

```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

## Testes e qualidade

```bash
# Backend
cd backend
npm run lint

# Frontend
cd frontend
npm run lint
npx vite build   # garante que o bundle de produção compila
```

Ambos os projetos estão configurados com ESLint + Prettier. Ajuste regras conforme necessário.

## Próximos passos sugeridos

- Implementar upload para armazenamento público (S3/Cloudinary) em `services/instagram.js`.
- Completar o fluxo do TikTok (`services/tiktok.js`) com criação da sessão e envio do vídeo.
- Adicionar persistência de postagens, logs estruturados e autenticação no painel.
- Criar pipeline automatizada (CI) com lint/build antes do deploy.

## Segurança

- `.env`, `tokens/` e `tmp/` estão ignorados no Git: mantenha-os fora do repositório remoto.
- Armazene tokens de produção em um cofre seguro (Vault, Secret Manager, etc.).
- Limpe arquivos temporários e monitore quotas/erros das APIs com atenção.

---

Feito com ❤️ para facilitar o planejamento e a publicação simultânea do seu conteúdo.
