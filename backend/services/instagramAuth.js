const path = require('node:path');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TOKENS_DIR = path.resolve(__dirname, '..', 'tokens');
const INSTAGRAM_TOKENS_FILE = path.resolve(TOKENS_DIR, 'instagram.json');

const {
  FB_APP_ID,
  FB_APP_SECRET,
  FB_REDIRECT_URI = 'http://localhost:4000/auth/instagram/callback',
} = process.env;

const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

function ensureAppCredentials() {
  if (!FB_APP_ID || !FB_APP_SECRET) {
    throw new Error(
      'Configure FB_APP_ID e FB_APP_SECRET no backend/.env antes de executar o fluxo do Instagram.',
    );
  }
}

async function ensureTokensDir() {
  await fsPromises.mkdir(TOKENS_DIR, { recursive: true });
}

function getStoredInstagramCredentials() {
  try {
    const raw = fs.readFileSync(INSTAGRAM_TOKENS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function saveInstagramCredentials(data) {
  await ensureTokensDir();
  await fsPromises.writeFile(
    INSTAGRAM_TOKENS_FILE,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        ...data,
      },
      null,
      2,
    ),
    'utf8',
  );
}

function getInstagramAuthUrl() {
  ensureAppCredentials();
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: FB_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForLongLivedToken(code) {
  ensureAppCredentials();

  const shortLivedResp = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
    params: {
      client_id: FB_APP_ID,
      redirect_uri: FB_REDIRECT_URI,
      client_secret: FB_APP_SECRET,
      code,
    },
  });

  const shortLivedToken = shortLivedResp.data?.access_token;

  if (!shortLivedToken) {
    throw new Error('Não foi possível obter o access_token temporário.');
  }

  const longLivedResp = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });

  const longLivedToken = longLivedResp.data?.access_token;

  if (!longLivedToken) {
    throw new Error('Não foi possível obter o access_token de longa duração.');
  }

  return {
    shortLivedToken,
    longLivedToken,
    expiresIn: longLivedResp.data?.expires_in,
  };
}

async function fetchInstagramDetails(longLivedToken) {
  const accountsResp = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
    params: {
      access_token: longLivedToken,
      fields: 'name,id,access_token',
    },
  });

  const pages = accountsResp.data?.data || [];

  if (!pages.length) {
    throw new Error('Nenhuma página encontrada para este usuário Facebook.');
  }

  for (const page of pages) {
    const pageDetailsResp = await axios.get(
      `https://graph.facebook.com/v19.0/${page.id}`,
      {
        params: {
          fields: 'instagram_business_account,name',
          access_token: page.access_token,
        },
      },
    );

    const pageDetails = pageDetailsResp.data;
    const igAccountId = pageDetails?.instagram_business_account?.id;

    if (igAccountId) {
      return {
        page: {
          id: page.id,
          name: pageDetails?.name || page.name,
          access_token: page.access_token,
        },
        instagram: {
          user_id: igAccountId,
        },
      };
    }
  }

  throw new Error(
    'Nenhuma página com conta Instagram profissional vinculada foi encontrada. Verifique o vínculo nas configurações do Instagram/Facebook.',
  );
}

async function handleInstagramCallback(code) {
  const tokenInfo = await exchangeCodeForLongLivedToken(code);
  const details = await fetchInstagramDetails(tokenInfo.longLivedToken);

  const payload = {
    userAccessToken: tokenInfo.longLivedToken,
    expiresIn: tokenInfo.expiresIn,
    page: details.page,
    instagram: details.instagram,
  };

  await saveInstagramCredentials(payload);

  return payload;
}

module.exports = {
  getInstagramAuthUrl,
  handleInstagramCallback,
  getStoredInstagramCredentials,
};

