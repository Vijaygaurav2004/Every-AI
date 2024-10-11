import { D1Database } from '@cloudflare/workers-types';

export async function initializeDatabase(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firebase_user_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response_type TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function saveToHistory(db: D1Database, firebaseUserId: string, toolName: string, prompt: string, responseType: string, response: string) {
  await db.prepare(
    'INSERT INTO history (firebase_user_id, tool_name, prompt, response_type, response) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(firebaseUserId, toolName, prompt, responseType, response)
    .run();
}

export async function getUserHistory(db: D1Database, firebaseUserId: string, limit: number = 50) {
  return await db.prepare('SELECT * FROM history WHERE firebase_user_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(firebaseUserId, limit)
    .all();
}

export async function deleteHistoryItem(db: D1Database, id: number, firebaseUserId: string) {
  await db.prepare('DELETE FROM history WHERE id = ? AND firebase_user_id = ?')
    .bind(id, firebaseUserId)
    .run();
}