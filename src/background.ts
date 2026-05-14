import { performScan, checkConnectivity, ScannerError } from './core/escl'
import { discoverScanners } from './core/discovery'
import { blobToDataUrl } from './core/utils'
import { addToHistory, generateId } from './storage'
import type { ScanSettings, ScanRecord } from './core/types'

let lastScan: ScanRecord | null = null

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse)
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
        if (!lastScan) return { success: false, error: 'Aucun scan disponible' }
        return { success: true, scan: lastScan }

      default:
        return { success: false, error: `Type de message inconnu : ${msg.type}` }
    }
  } catch (e) {
    let message = e instanceof Error ? e.message : 'Erreur inconnue'
    if (e instanceof ScannerError) {
      switch (e.code) {
        case 'expired':
          message = 'Le scanner a annulé le job. Vérifiez que le scanner est prêt et réessayez.'
          break
        case 'busy':
          message = 'Scanner occupé. Attendez quelques secondes et réessayez.'
          break
        case 'canceled':
          message = 'Scan annulé par le scanner. Réessayez.'
          break
        case 'network':
          message = "Impossible de joindre le scanner. Vérifiez l'adresse IP."
          break
      }
    } else if (message.includes('Failed to fetch')) {
      message = "Impossible de joindre le scanner. Vérifiez l'adresse IP."
    }
    return { success: false, error: message }
  }
}
