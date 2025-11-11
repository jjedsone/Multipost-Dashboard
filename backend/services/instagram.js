const path = require('node:path');
const fs = require('node:fs');

const axios = require('axios');
const FormData = require('form-data');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { getStoredInstagramCredentials } = require('./instagramAuth');

const { FB_PAGE_ACCESS_TOKEN, IG_USER_ID } = process.env;

function resolveInstagramConfig() {
  const stored = getStoredInstagramCredentials();

  const pageAccessToken =
    FB_PAGE_ACCESS_TOKEN || stored?.page?.access_token || process.env.FB_PAGE_ACCESS_TOKEN;

  const igUserId =
    IG_USER_ID || stored?.instagram?.user_id || process.env.IG_USER_ID;

  return {
    pageAccessToken,
    igUserId,
    stored,
  };
}

/**
 * Para publicar em um perfil profissional do Instagram via Graph API,
 * você precisa seguir os passos abaixo:
 *
 * 1. Hospedar o arquivo (imagem/vídeo) em uma URL pública acessível.
 *    - Em ambiente local, é comum fazer upload para S3 ou Cloudinary primeiro.
 *    - O Graph API não aceita upload direto de arquivo binário, apenas via URL.
 *
 * 2. Criar um `media container`:
 *    POST https://graph.facebook.com/v19.0/{ig-user-id}/media
 *    Body:
 *      - image_url OU video_url (apontando para o host público)
 *      - caption (opcional)
 *      - share_to_feed (para Reels pode usar upload_phase)
 *
 * 3. Verificar status do container (GET /{container_id})
 * 4. Publicar:
 *    POST https://graph.facebook.com/v19.0/{ig-user-id}/media_publish
 *    Body: creation_id={container_id}
 *
 * Obs.: Para vídeos é necessário usar upload em fases (`upload_phase=start, transfer, finish`)
 *       Consulte https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
 */

async function uploadToTemporaryHost(filePath) {
  // Placeholder: faça upload para seu serviço (S3/Cloudinary/etc.) e retorne a URL pública.
  // Aqui retornamos null para indicar que é necessário implementar antes.
  console.info('[Instagram] Implementar upload para host público (ex.: Cloudinary).');
  filePath; // evitar lint unused
  return null;
}

async function publishToInstagram({ filePath, caption }) {
  const { pageAccessToken, igUserId } = resolveInstagramConfig();

  if (!pageAccessToken || !igUserId) {
    return {
      ok: false,
      error:
        'Instagram não conectado. Use o botão "Conectar Instagram" no painel ou configure FB_PAGE_ACCESS_TOKEN e IG_USER_ID no backend/.env.',
    };
  }

  const absoluteFile = path.resolve(filePath);
  const exists = fs.existsSync(absoluteFile);

  if (!exists) {
    throw new Error('Arquivo de mídia não encontrado para upload no Instagram.');
  }

  const mediaUrl = await uploadToTemporaryHost(absoluteFile);

  if (!mediaUrl) {
    return {
      ok: false,
      error:
        'É necessário implementar upload para URL pública antes de publicar no Instagram (ex.: Cloudinary).',
    };
  }

  try {
    const form = new FormData();
    form.append('caption', caption || '');
    form.append('access_token', pageAccessToken);
    form.append('image_url', mediaUrl);

    const createResp = await axios.post(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      form,
      { headers: form.getHeaders() },
    );

    const creationId = createResp.data?.id;

    if (!creationId) {
      throw new Error('Falha ao criar media container para Instagram.');
    }

    const publishResp = await axios.post(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
      new URLSearchParams({
        creation_id: creationId,
        access_token: FB_PAGE_ACCESS_TOKEN,
      }),
    );

    return {
      ok: true,
      creationId,
      publishResult: publishResp.data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data || error.message,
    };
  }
}

module.exports = {
  publishToInstagram,
};

