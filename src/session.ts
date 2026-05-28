import { Store } from '@tauri-apps/plugin-store';
import { AnalysisSession } from './type';

let storeAnalyses: Store | null = null;

async function init() {
  storeAnalyses = await Store.load('analyses.json');
}

async function getStoreAnalyses() {
  if (!storeAnalyses) {
    await init();
  }

  return storeAnalyses as Store;
}

export async function loadSessions() {
  const store = await getStoreAnalyses();
  const sessions =
    (await store.get<Record<string, AnalysisSession>>('sessions')) ||
    {};

  return Object.values(sessions);
}
export async function loadSession(sessionId: string) {
  const store = await getStoreAnalyses();
  const sessions =
    (await store.get<Record<string, AnalysisSession>>('sessions')) ||
    {};

  return sessions[sessionId];
}

export async function saveSession(session: AnalysisSession) {
  const store = await getStoreAnalyses();

  const sessions =
    (await store.get<Record<string, AnalysisSession>>('sessions')) ||
    {};

  sessions[session.id] = session;

  await store.set('sessions', sessions);
  await store.save();
}

export async function deleteSession(id: string) {
  const store = await getStoreAnalyses();
  const sessions =
    (await store.get<Record<string, AnalysisSession>>('sessions')) ||
    {};

  delete sessions[id];

  await store.set('sessions', sessions);
  await store.save();
}

init();
