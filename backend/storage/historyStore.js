const fs = require('node:fs/promises');
const path = require('node:path');

const HISTORY_DIR = path.resolve(__dirname);
const HISTORY_FILE = path.resolve(HISTORY_DIR, 'history.json');
const MAX_HISTORY_ITEMS = Number(process.env.HISTORY_MAX_ITEMS || 100);

async function ensureHistoryFile() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  try {
    await fs.access(HISTORY_FILE);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
    } else {
      throw error;
    }
  }
}

async function readHistory() {
  await ensureHistoryFile();
  const raw = await fs.readFile(HISTORY_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[HistoryStore] Arquivo corrompido, recriando.');
    await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
}

async function appendEntry(entry) {
  const history = await readHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY_ITEMS) {
    history.length = MAX_HISTORY_ITEMS;
  }
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  return history[0];
}

async function logPost({ payload, results }) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: `${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    payload,
    results,
  };
  await appendEntry(entry);
  return entry;
}

module.exports = {
  readHistory,
  logPost,
};
