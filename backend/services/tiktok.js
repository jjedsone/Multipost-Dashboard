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
  TT_DEFAULT_PRIVACY = 'PUBLIC_TO_EVERYONE',
} = process.env;

const TIKTOK_API_BASE = 'https://open-api.tiktok.com';

async function requestTikTok(endpoint, { method = 'GET', data, params, headers = {}, accessToken }) {
  const url = `${TIKTOK_API_BASE}${endpoint}`;

  const response = await axios({
    url,
    method,
    data,
    params,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  return response.data;
}

async function refreshAccessToken() {
  if (!TT_CLIENT_KEY || !TT_CLIENT_SECRET || !TT_REFRESH_TOKEN) {
    return null;
  }

  try {
    const response = await axios.post(`${TIKTOK_API_BASE}/oauth/refresh_token/`, {
      client_key: TT_CLIENT_KEY,
      client_secret: TT_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: TT_REFRESH_TOKEN,
    });

    const token = response.data?.data?.access_token;

    if (!token) {
      console.error('[TikTok] Refresh token inválido.', response.data);
      return null;
    }

    return {
      accessToken: token,
      openId: response.data?.data?.open_id,
      expiresIn: response.data?.data?.expires_in,
    };
  } catch (error) {
    console.error('[TikTok] Falha ao renovar access token:', error.response?.data || error.message);
    return null;
  }
}

async function createUploadSession({ accessToken, fileSize }) {
  const payload = {
    source: 'FILE_UPLOAD',
    media_type: 'VIDEO',
    video_size: fileSize,
  };

  const data = await requestTikTok('/share/video/upload/', {
    method: 'POST',
    data: payload,
    accessToken,
  });

  const uploadId = data?.data?.upload_id;
  const uploadUrl = data?.data?.upload_url;

  if (!uploadId || !uploadUrl) {
    throw new Error('TikTok não retornou upload_id/upload_url.');
  }

  return { uploadId, uploadUrl };
}

async function uploadVideoFile({ uploadUrl, filePath }) {
  const stream = fs.createReadStream(filePath);

  await axios.put(uploadUrl, stream, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
}

async function publishVideo({ accessToken, uploadId, text, title, privacy }) {
  const payload = {
    upload_id: uploadId,
    text,
    title: title?.slice(0, 80),
    privacy_level: privacy,
  };

  const data = await requestTikTok('/share/video/publish/', {
    method: 'POST',
    data: payload,
    accessToken,
  });

  if (data?.data?.error_code && data.data.error_code !== 0) {
    throw new Error(`TikTok retornou erro ${data.data.error_code}: ${data.data.description}`);
  }

  return data?.data || data;
}

function buildTikTokCaption({ title, caption, tags }) {
  const parts = [];
  if (title) parts.push(title);
  if (caption) parts.push(caption);
  if (Array.isArray(tags) && tags.length) {
    parts.push(tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' '));
  }

  const combined = parts.filter(Boolean).join(' • ');
  return combined.slice(0, 150);
}

async function publishToTikTok({ filePath, caption, tags, title }) {
  const absoluteFile = path.resolve(filePath);
  if (!fs.existsSync(absoluteFile)) {
    throw new Error('Arquivo de mídia não encontrado para upload no TikTok.');
  }

  const tokenInfo = await refreshAccessToken();

  if (!tokenInfo?.accessToken) {
    return {
      ok: false,
      error:
        'Não foi possível obter access_token do TikTok. Verifique TT_CLIENT_KEY, TT_CLIENT_SECRET e TT_REFRESH_TOKEN.',
    };
  }

  const fileStats = fs.statSync(absoluteFile);
  const privacy = TT_DEFAULT_PRIVACY;
  const text = buildTikTokCaption({ title, caption, tags });

  try {
    const session = await createUploadSession({
      accessToken: tokenInfo.accessToken,
      fileSize: fileStats.size,
    });

    await uploadVideoFile({
      uploadUrl: session.uploadUrl,
      filePath: absoluteFile,
    });

    const publishResult = await publishVideo({
      accessToken: tokenInfo.accessToken,
      uploadId: session.uploadId,
      text,
      title,
      privacy,
    });

    return {
      ok: true,
      uploadId: session.uploadId,
      publishResult,
      openId: tokenInfo.openId,
      info: {
        sizeBytes: fileStats.size,
        privacy,
        redirectUri: TT_REDIRECT_URI,
      },
    };
  } catch (error) {
    console.error('[TikTok] Erro no fluxo de upload:', error.response?.data || error.message);
    return {
      ok: false,
      error: error.response?.data || error.message,
    };
  }
}

async function getTikTokStatus() {
  const checkedAt = new Date().toISOString();
  const missing = [];

  if (!TT_CLIENT_KEY) missing.push('TT_CLIENT_KEY');
  if (!TT_CLIENT_SECRET) missing.push('TT_CLIENT_SECRET');
  if (!TT_REFRESH_TOKEN) missing.push('TT_REFRESH_TOKEN');

  if (missing.length) {
    return {
      connected: false,
      missing,
      checkedAt,
    };
  }

  const tokenInfo = await refreshAccessToken();

  if (!tokenInfo?.accessToken) {
    return {
      connected: false,
      checkedAt,
      error: 'Não foi possível renovar access_token do TikTok. Verifique as credenciais.',
    };
  }

  return {
    connected: true,
    checkedAt,
    expiresIn: tokenInfo.expiresIn,
    openId: tokenInfo.openId,
    redirectUri: TT_REDIRECT_URI,
  };
}

module.exports = {
  publishToTikTok,
  getTikTokStatus,
};
