import { StorageItem } from 'webext-storage'
import type { SavedScanner, ScanRecord, ScanSettings } from '../core/types'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Storage items ────────────────────────────────────────────

const scannersItem = new StorageItem<SavedScanner[]>('scanners')
const activeScannerIdItem = new StorageItem<string>('activeScannerId')
const scanHistoryItem = new StorageItem<ScanRecord[]>('scanHistory')
const currentScanItem = new StorageItem<ScanRecord>('currentScan')
const defaultSettingsItem = new StorageItem<Partial<ScanSettings>>('defaultSettings', { area: 'sync' })

// ─── Scanners ─────────────────────────────────────────────────

export async function getScanners(): Promise<SavedScanner[]> {
  return (await scannersItem.get()) ?? []
}

export async function saveScanner(scanner: SavedScanner): Promise<void> {
  const list = await getScanners()
  const idx = list.findIndex(s => s.id === scanner.id)
  if (idx >= 0) list[idx] = scanner
  else list.push(scanner)
  await scannersItem.set(list)
}

export async function deleteScanner(id: string): Promise<void> {
  const list = await getScanners()
  await scannersItem.set(list.filter(s => s.id !== id))
}

export async function getActiveScanner(): Promise<SavedScanner | null> {
  const [scanners, activeId] = await Promise.all([
    getScanners(),
    activeScannerIdItem.get(),
  ])
  return scanners.find(s => s.id === activeId) ?? scanners[0] ?? null
}

export async function setActiveScanner(id: string): Promise<void> {
  await activeScannerIdItem.set(id)
}

// ─── Settings ─────────────────────────────────────────────────

const DEFAULT_SETTINGS: ScanSettings = {
  dpi: 300,
  colorMode: 'RGB24',
  format: 'jpeg',
}

export async function getSettings(): Promise<ScanSettings> {
  const saved = await defaultSettingsItem.get()
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function saveSettings(settings: Partial<ScanSettings>): Promise<void> {
  const current = await getSettings()
  await defaultSettingsItem.set({ ...current, ...settings })
}

// ─── Historique ───────────────────────────────────────────────

const MAX_HISTORY = 10

export async function getHistory(): Promise<ScanRecord[]> {
  return (await scanHistoryItem.get()) ?? []
}

export async function addToHistory(record: ScanRecord): Promise<void> {
  const history = await getHistory()
  const updated = [record, ...history].slice(0, MAX_HISTORY)
  await Promise.all([
    scanHistoryItem.set(updated),
    currentScanItem.set(record),
  ])
}

export async function deleteFromHistory(id: string): Promise<void> {
  const history = await getHistory()
  await scanHistoryItem.set(history.filter(r => r.id !== id))
}

export async function getCurrentScan(): Promise<ScanRecord | null> {
  return (await currentScanItem.get()) ?? null
}
