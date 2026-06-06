import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from '@tauri-apps/plugin-fs';

import { AnalysisSession } from './type';

const DIR = 'analyses';
const EXTENSION = '.json';

async function ensureDir() {
  const ok = await exists(DIR, {
    baseDir: BaseDirectory.AppData,
  });

  if (!ok) {
    await mkdir(DIR, {
      baseDir: BaseDirectory.AppData,
    });
  }
}

export async function loadSession(sessionId: string) {
  await ensureDir();

  const path = `${DIR}/${sessionId}${EXTENSION}`;

  const ok = await exists(path, {
    baseDir: BaseDirectory.AppData,
  });

  if (!ok) {
    return null;
  }

  const text = await readTextFile(path, {
    baseDir: BaseDirectory.AppData,
  });

  let session = JSON.parse(text) as AnalysisSession;
  for (const state of session.states) {
    if (state.sentenceResult) {
      state.progressMessage = 'Loaded from previous session';
    }
  }
  return session;
}

export async function saveSession(session: AnalysisSession) {
  await ensureDir();
  const path = `${DIR}/${session.id}${EXTENSION}`;
  await writeTextFile(path, JSON.stringify(session, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function loadSessions() {
  await ensureDir();

  const entries = await readDir(DIR, {
    baseDir: BaseDirectory.AppData,
  });

  const sessions: AnalysisSession[] = [];

  for (const entry of entries) {
    if (!entry.name?.endsWith(EXTENSION)) {
      continue;
    }

    const session = await loadSession(entry.name.slice(0, -EXTENSION.length));

    if (session) {
      sessions.push(session);
    }
  }

  return sessions;
}

export async function deleteSession(id: string) {
  const path = `${DIR}/${id}${EXTENSION}`;

  const ok = await exists(path, {
    baseDir: BaseDirectory.AppData,
  });

  if (!ok) {
    return;
  }

  await remove(path, {
    baseDir: BaseDirectory.AppData,
  });
}
