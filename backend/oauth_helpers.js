const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const dotenv = require('dotenv');
const { google } = require('googleapis');

dotenv.config();

const {
  YT_CLIENT_ID,
  YT_CLIENT_SECRET,
  YT_REDIRECT_URI = 'http://localhost:4000/oauth2callback',
} = process.env;

if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) {
  console.warn(
    '⚠️  Defina YT_CLIENT_ID e YT_CLIENT_SECRET no arquivo .env antes de usar oauth_helpers.js',
  );
}

const oauth2Client = new google.auth.OAuth2(
  YT_CLIENT_ID,
  YT_CLIENT_SECRET,
  YT_REDIRECT_URI,
);

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'];

function generateYouTubeAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

async function exchangeCodeForTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function writeRefreshTokenToEnv(refreshToken) {
  const envPath = path.resolve(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, '', 'utf8');
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  const regex = /^YT_REFRESH_TOKEN=.*$/m;

  if (regex.test(contents)) {
    const updated = contents.replace(regex, `YT_REFRESH_TOKEN=${refreshToken}`);
    fs.writeFileSync(envPath, updated, 'utf8');
  } else {
    const suffix = contents.endsWith('\n') || contents.length === 0 ? '' : '\n';
    fs.appendFileSync(envPath, `${suffix}YT_REFRESH_TOKEN=${refreshToken}\n`, 'utf8');
  }
}

async function runInteractiveFlow() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => {
      rl.question(query, resolve);
    });

  try {
    const authUrl = generateYouTubeAuthUrl();
    console.log('Abra a URL abaixo, autorize o aplicativo e cole o "code" retornado:');
    console.log(authUrl);
    const code = await question('\nCole aqui o code: ');
    const tokens = await exchangeCodeForTokens(code.trim());

    if (tokens.refresh_token) {
      console.log('\n✅ Refresh token obtido com sucesso!');
      await writeRefreshTokenToEnv(tokens.refresh_token);
      console.log('Refresh token gravado/atualizado no arquivo backend/.env.\n');
    } else {
      console.log('\n⚠️ Nenhum refresh_token retornado. Verifique se solicitou access_type=offline.\n');
    }

    console.log('Tokens completos:', tokens);
  } catch (error) {
    console.error('Erro ao obter tokens:', error.message);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  runInteractiveFlow();
}

module.exports = {
  generateYouTubeAuthUrl,
  exchangeCodeForTokens,
  runInteractiveFlow,
};

