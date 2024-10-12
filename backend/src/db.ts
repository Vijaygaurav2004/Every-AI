import { KVNamespace } from '@cloudflare/workers-types';

export interface HistoryItem {
  id: string;
  firebaseUserId: string;
  tool: string;
  prompt: string;
  response: string;
  type: string;
  timestamp: number;
}

export async function saveToHistory(kv: KVNamespace, firebaseUserId: string, tool: string, prompt: string, response: string, type: string) {
  const timestamp = Date.now();
  const id = `${firebaseUserId}_${timestamp}`;
  const item: HistoryItem = { id, firebaseUserId, tool, prompt, response, type, timestamp };
  await kv.put(id, JSON.stringify(item));
  console.log('History saved successfully');
}

export async function getUserHistory(kv: KVNamespace, firebaseUserId: string, limit: number = 50): Promise<HistoryItem[]> {
  const list = await kv.list({ prefix: `${firebaseUserId}_` });
  const history: HistoryItem[] = [];
  for (const key of list.keys.slice(0, limit)) {
    const item = await kv.get(key.name);
    if (item) {
      history.push(JSON.parse(item));
    }
  }
  return history.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteHistoryItem(kv: KVNamespace, id: string, firebaseUserId: string) {
  await kv.delete(id);
  console.log('History item deleted successfully');
}