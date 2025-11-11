const path = require('node:path');
const fs = require('node:fs');

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const {
  TT_CLIENT_KEY,
  TT_CLIENT_SECRET,
  TT_REFRESH_TOKEN,
  TT_REDIRECT_URI = 'http://localhost:4000/tiktok/callback',
} = process.env;

/**
 * O fluxo oficial do TikTok for Developers (Content Posting) envolve:
 *
 * 1. Obter access_token (com refresh token) via OAuth (https://developers.tiktok.com).
 * 2. Criar uma upload session:
 *    POST https://open-api.tiktok.com/share/upload/
 *    Headers: Authorization: Bearer {access_token}
 *    Body: {
 *      source: "FILE_UPLOAD",
 *      media_type: "VIDEO",
 *      video_size: <bytes>
 *    }
 *    => retorna upload_id + upload_url
 *
 * 3. Enviar o arquivo de vídeo para upload_url (PUT binário).
 * 4. Criar o post:
 *    POST https://open-api.tiktok.com/share/video/submit/
 *    Body: {
 *      upload_id,
 *      text,
 *      title,
 *      privacy_level
 *    }
 *
 * Este arquivo contém um stub para você preencher com base na documentação oficial.
 */

async function refreshAccessToken() {
  if (!TT_CLIENT_KEY || !TT_CLIENT_SECRET || !TT_REFRESH_TOKEN) {
    return null;
  }

  try {
    const response = await axios.post('https://open-api.tiktok.com/oauth/refresh_token/', {
      client_key: TT_CLIENT_KEY,
      client_secret: TT_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: TT_REFRESH_TOKEN,
    });

    return response.data?.data?.access_token || null;
  } catch (error) {
    console.error('[TikTok] Falha ao renovar access token:', error.message);
    return null;
  }
}

async function publishToTikTok({ filePath, caption }) {
  const absoluteFile = path.resolve(filePath);
  const exists = fs.existsSync(absoluteFile);

  if (!exists) {
    throw new Error('Arquivo de mídia não encontrado para upload no TikTok.');
  }

  const accessToken = await refreshAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      error:
        'Configure TT_CLIENT_KEY, TT_CLIENT_SECRET e TT_REFRESH_TOKEN no backend/.env para iniciar o fluxo e/ou implemente refresh manual.',
    };
  }

  const fileStats = fs.statSync(absoluteFile);

  console.info('[TikTok] Stub de upload chamado. Complete a implementação conforme documentação.');

  return {
    ok: false,
    error:
      'Fluxo de upload do TikTok ainda não implementado. Siga as instruções em backend/services/tiktok.js',
    context: {
      fileSizeBytes: fileStats.size,
      caption,
      redirectUri: TT_REDIRECT_URI,
    },
  };
}

module.exports = {
  publishToTikTok,
};

