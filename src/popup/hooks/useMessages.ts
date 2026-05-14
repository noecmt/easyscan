import type { ScanRecord, ScanSettings, DiscoveredScanner } from '../../core/types'

interface MessageMap {
  START_SCAN: { ip: string; settings: ScanSettings }
  DISCOVER_SCANNERS: Record<string, never>
  CONNECTIVITY_TEST: { ip: string }
}

interface ResponseMap {
  START_SCAN: { success: true; record: ScanRecord } | { success: false; error: string }
  DISCOVER_SCANNERS: { success: true; scanners: DiscoveredScanner[] }
  CONNECTIVITY_TEST: { success: true } | { success: false }
}

export function sendMessage<T extends keyof MessageMap>(
  type: T,
  payload: MessageMap[T]
): Promise<ResponseMap[T]> {
  return chrome.runtime.sendMessage({ type, ...payload })
}
