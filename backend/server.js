const path = require('node:path');
const fs = require('node:fs');
const util = require('node:util');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');

const { publishToYouTube, getYouTubeStatus } = require('./services/youtube');
const { publishToInstagram } = require('./services/instagram');
const { publishToTikTok, getTikTokStatus } = require('./services/tiktok');
const {
  getInstagramAuthUrl,
  handleInstagramCallback,
  getStoredInstagramCredentials,
} = require('./services/instagramAuth');
const { logPost, readHistory } = require('./storage/historyStore');

dotenv.config();

const app = express();

const TMP_DIR = path.resolve(__dirname, 'tmp');
const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 512);

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
});

const unlinkAsync = util.promisify(fs.unlink);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/history', async (req, res) => {
  try {
    const history = await readHistory();
    res.json({ ok: true, history });
  } catch (error) {
    console.error('[History] Erro ao ler histórico:', error);
    res.status(500).json({ error: 'Não foi possível carregar o histórico.' });
  }
});

app.get('/status/youtube', async (req, res) => {
  try {
    const status = await getYouTubeStatus();
    res.json(status);
  } catch (error) {
    console.error('[YouTube] Status error:', error);
    res.status(500).json({ connected: false, error: 'Falha ao verificar status do YouTube.' });
  }
});

app.get('/status/tiktok', async (req, res) => {
  try {
    const status = await getTikTokStatus();
    res.json(status);
  } catch (error) {
    console.error('[TikTok] Status error:', error);
    res.status(500).json({ connected: false, error: 'Falha ao verificar status do TikTok.' });
  }
});

app.get('/auth/instagram/url', (req, res) => {
  try {
    const url = getInstagramAuthUrl();
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/instagram/status', (req, res) => {
  const credentials = getStoredInstagramCredentials();
  const connected = Boolean(credentials?.page?.access_token && credentials?.instagram?.user_id);

  res.json({
    connected,
    page: connected
      ? {
          id: credentials.page.id,
          name: credentials.page.name,
        }
      : null,
    updatedAt: credentials?.updatedAt || null,
  });
});

app.get('/auth/instagram/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res
      .status(400)
      .send(`<h1>Erro na autorização</h1><p>${error}</p><p>Você pode fechar esta janela.</p>`);
  }

  if (!code) {
    return res.status(400).send('<h1>Code ausente</h1><p>Tente novamente.</p>');
  }

  try {
    const payload = await handleInstagramCallback(code);
    const pageName = payload.page?.name || 'página Instagram';
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 40px;">
          <h1>Instagram conectado!</h1>
          <p>Página vinculada: <strong>${pageName}</strong></p>
          <p>Você pode fechar esta janela e voltar ao painel.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (callbackError) {
    console.error('[Instagram] Callback error:', callbackError);
    res
      .status(500)
      .send('<h1>Erro ao completar a conexão</h1><p>Verifique o console do servidor.</p>');
  }
});

app.post('/post', upload.single('media'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo de mídia é obrigatório.' });
  }

  const { caption = '', tags = '', title = '' } = req.body;
  const platformsRaw = req.body.platforms;

  const platforms = Array.isArray(platformsRaw)
    ? platformsRaw
    : platformsRaw
      ? platformsRaw.split(',').map((p) => p.trim()).filter(Boolean)
      : [];

  if (!platforms.length) {
    await unlinkAsync(req.file.path);
    return res.status(400).json({ error: 'Selecione ao menos uma plataforma.' });
  }

  const normalizedTags = typeof tags === 'string'
    ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  const results = {};

  try {
    await Promise.allSettled(
      platforms.map(async (platform) => {
        switch (platform) {
          case 'youtube': {
            results.youtube = await publishToYouTube({
              filePath: req.file.path,
              caption,
              tags: normalizedTags,
              title,
            });
            break;
          }
          case 'instagram': {
            results.instagram = await publishToInstagram({
              filePath: req.file.path,
              caption,
              tags: normalizedTags,
              mimeType: req.file.mimetype,
            });
            break;
          }
          case 'tiktok': {
            results.tiktok = await publishToTikTok({
              filePath: req.file.path,
              caption,
              title,
              tags: normalizedTags,
            });
            break;
          }
          default:
            results[platform] = { ok: false, error: 'Plataforma desconhecida.' };
        }
      }),
    );

    await logPost({
      payload: {
        caption,
        title,
        tags: normalizedTags,
        platforms,
      },
      results,
    });

    res.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error('Erro no /post:', error);
    res.status(500).json({ error: 'Erro ao processar postagem.', details: error.message });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      await unlinkAsync(req.file.path);
    }
  }
});

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Servidor Multipost ouvindo em http://localhost:${port}`);
});

