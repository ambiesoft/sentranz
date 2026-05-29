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

  const path = `${DIR}/${sessionId}.json`;

  const ok = await exists(path, {
    baseDir: BaseDirectory.AppData,
  });

  if (!ok) {
    return null;
  }

  const text = await readTextFile(path, {
    baseDir: BaseDirectory.AppData,
  });

  return JSON.parse(text) as AnalysisSession;
}

export async function saveSession(session: AnalysisSession) {
  await ensureDir();

  const path = `${DIR}/${session.id}.json`;

  await writeTextFile(
    path,

    JSON.stringify(session, null, 2),

    {
      baseDir: BaseDirectory.AppData,
    },
  );
}

export async function loadSessions() {
  await ensureDir();

  const entries = await readDir(DIR, {
    baseDir: BaseDirectory.AppData,
  });

  const sessions: AnalysisSession[] = [];

  for (const entry of entries) {
    if (!entry.name?.endsWith('.json')) {
      continue;
    }

    const text = await readTextFile(`${DIR}/${entry.name}`, {
      baseDir: BaseDirectory.AppData,
    });

    sessions.push(JSON.parse(text));
  }

  return sessions;
}

export async function deleteSession(id: string) {
  const path = `${DIR}/${id}.json`;

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
