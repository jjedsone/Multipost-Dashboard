const fs = require('node:fs');
const path = require('node:path');

const { google } = require('googleapis');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const {
  YT_CLIENT_ID,
  YT_CLIENT_SECRET,
  YT_REDIRECT_URI,
  YT_REFRESH_TOKEN,
} = process.env;

if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.warn('⚠️ Configure YT_CLIENT_ID, YT_CLIENT_SECRET e YT_REFRESH_TOKEN no backend/.env para habilitar o upload em YouTube.');
}

const oauth2Client = new google.auth.OAuth2(
  YT_CLIENT_ID,
  YT_CLIENT_SECRET,
  YT_REDIRECT_URI || 'http://localhost:4000/oauth2callback',
);

if (YT_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: YT_REFRESH_TOKEN,
  });
}

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

function ensureTags(tags) {
  if (!Array.isArray(tags)) return undefined;
  const sanitized = tags.map((tag) => tag.trim()).filter(Boolean);
  return sanitized.length ? sanitized : undefined;
}

async function publishToYouTube({ filePath, caption, tags, title }) {
  if (!YT_REFRESH_TOKEN) {
    throw new Error('YT_REFRESH_TOKEN não configurado. Gere o refresh token usando oauth_helpers.js.');
  }

  const absoluteFile = path.resolve(filePath);

  const fileStats = fs.statSync(absoluteFile);
  if (!fileStats.isFile()) {
    throw new Error('Arquivo de mídia inválido.');
  }

  const videoTitle = title || `Multipost upload - ${new Date().toISOString()}`;
  const description = caption || '';

  const requestBody = {
    snippet: {
      title: videoTitle,
      description,
      tags: ensureTags(tags),
    },
    status: {
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
  };

  const media = {
    body: fs.createReadStream(absoluteFile),
  };

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody,
    media,
  });

  const { data } = response;

  return {
    ok: true,
    videoId: data.id,
    url: data.id ? `https://studio.youtube.com/video/${data.id}/edit` : undefined,
  };
}

module.exports = {
  publishToYouTube,
};

