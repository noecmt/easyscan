import { performScan, checkConnectivity, ScannerError } from './core/escl'
import { discoverScanners } from './core/discovery'
import { blobToDataUrl } from './core/utils'
import { addToHistory, generateId } from './storage'
import type { ScanSettings, ScanRecord } from './core/types'
import { t, initI18n } from './utils/i18n'

let lastScan: ScanRecord | null = null
let i18nReady = initI18n()

chrome.storage.onChanged.addListener(changes => {
  if (changes.lang) i18nReady = initI18n()
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  i18nReady.then(() => handleMessage(msg)).then(sendResponse)
  return true
})

async function handleMessage(msg: { type: string } & Record<string, unknown>) {
  try {
    switch (msg.type) {
      case 'START_SCAN': {
        const { ip, settings } = msg as { ip: string; settings: ScanSettings }
        const result = await performScan(`http://${ip}`, settings)
        const dataUrl = await blobToDataUrl(result.blob)
        const record: ScanRecord = {
          id: generateId(),
          dataUrl,
          mimeType: result.mimeType,
          timestamp: Date.now(),
        }
        await addToHistory(record)
        lastScan = record
        return { success: true, record }
      }

      case 'DISCOVER_SCANNERS': {
        const scanners = await discoverScanners()
        return { success: true, scanners }
      }

      case 'CONNECTIVITY_TEST': {
        const { ip } = msg as { ip: string }
        const ok = await checkConnectivity(`http://${ip}`)
        return { success: ok }
      }

      case 'GET_LAST_SCAN':
        return { success: true, scan: lastScan }

      case 'COPY_LAST_SCAN':
        if (!lastScan) return { success: false, error: t('noScanAvailable') }
        return { success: true, scan: lastScan }

      default:
        return { success: false, error: t('unknownMessage', [msg.type]) }
    }
  } catch (e) {
    let message = e instanceof Error ? e.message : t('unknownError')
    if (e instanceof ScannerError) {
      switch (e.code) {
        case 'expired':  message = t('scannerExpired'); break
        case 'busy':     message = t('scannerBusy'); break
        case 'canceled': message = t('scannerCancelled'); break
        case 'network':  message = t('scannerUnreachable'); break
      }
    } else if (message.includes('Failed to fetch')) {
      message = t('scannerUnreachable')
    }
    return { success: false, error: message }
  }
}
