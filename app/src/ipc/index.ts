import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export async function invokeCommand<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, payload);
  } catch (error) {
    console.error('IPC invoke failed', command, error);
    throw error;
  }
}

export function subscribeEvent<T>(event: string, handler: (payload: T) => void) {
  return listen<T>(event, (message) => handler(message.payload));
}
