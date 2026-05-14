import { useReducer } from 'preact/hooks'
import { ScannerSelector } from './components/ScannerSelector'
import { ScanControls } from './components/ScanControls'
import { ScanButton } from './components/ScanButton'
import { PreviewPanel } from './components/PreviewPanel'
import { StatusBar } from './components/StatusBar'
import { sendMessage } from './hooks/useMessages'
import { useScanner } from './hooks/useScanner'
import { setActiveScanner, saveScanner, saveSettings } from '../storage'
import { generateId } from '../storage'
import type { SavedScanner, ScanRecord, ScanSettings } from '../core/types'

type AppStatus = 'idle' | 'discovering' | 'scanning' | 'done' | 'error'

interface AppState {
  status: AppStatus
  scanners: SavedScanner[]
  activeScannerId: string | null
  settings: ScanSettings
  currentScan: ScanRecord | null
  errorMessage: string | null
}

type AppAction =
  | { type: 'SET_SCANNERS'; scanners: SavedScanner[] }
  | { type: 'SET_ACTIVE_SCANNER'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ScanSettings> }
  | { type: 'START_SCAN' }
  | { type: 'SCAN_DONE'; record: ScanRecord }
  | { type: 'SCAN_ERROR'; message: string }
  | { type: 'START_DISCOVER' }
  | { type: 'DISCOVER_DONE'; scanners: SavedScanner[] }

const DEFAULT_SETTINGS: ScanSettings = { dpi: 300, colorMode: 'RGB24', format: 'jpeg' }

const initialState: AppState = {
  status: 'idle',
  scanners: [],
  activeScannerId: null,
  settings: DEFAULT_SETTINGS,
  currentScan: null,
  errorMessage: null,
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SCANNERS':
      return { ...state, scanners: action.scanners }
    case 'SET_ACTIVE_SCANNER':
      return { ...state, activeScannerId: action.id }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'START_SCAN':
      return { ...state, status: 'scanning', errorMessage: null }
    case 'SCAN_DONE':
      return { ...state, status: 'done', currentScan: action.record }
    case 'SCAN_ERROR':
      return { ...state, status: 'error', errorMessage: action.message }
    case 'START_DISCOVER':
      return { ...state, status: 'discovering' }
    case 'DISCOVER_DONE':
      return { ...state, status: 'idle', scanners: action.scanners }
    default:
      return state
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { status, scanners, activeScannerId, settings, currentScan, errorMessage } = state

  useScanner((loadedScanners, loadedSettings, activeId) => {
    dispatch({ type: 'SET_SCANNERS', scanners: loadedScanners })
    if (activeId) dispatch({ type: 'SET_ACTIVE_SCANNER', id: activeId })
    dispatch({ type: 'UPDATE_SETTINGS', settings: loadedSettings })
  })

  const activeScanner = scanners.find(s => s.id === activeScannerId) ?? null

  const handleSelectScanner = async (id: string) => {
    await setActiveScanner(id)
    dispatch({ type: 'SET_ACTIVE_SCANNER', id })
  }

  const handleUpdateSettings = async (partial: Partial<ScanSettings>) => {
    await saveSettings(partial)
    dispatch({ type: 'UPDATE_SETTINGS', settings: partial })
  }

  const handleDiscover = async () => {
    dispatch({ type: 'START_DISCOVER' })
    try {
      const res = await sendMessage('DISCOVER_SCANNERS', {})
      const newOnes = res.scanners
        .filter(d => !scanners.some(e => e.ip === d.ip))
        .map(d => ({ id: generateId(), name: d.name, ip: d.ip, lastUsed: Date.now() }))
      for (const s of newOnes) await saveScanner(s)
      const updated = [...scanners, ...newOnes]
      dispatch({ type: 'DISCOVER_DONE', scanners: updated })
      if (!activeScannerId && updated.length > 0) {
        await setActiveScanner(updated[0].id)
        dispatch({ type: 'SET_ACTIVE_SCANNER', id: updated[0].id })
      }
    } catch {
      dispatch({ type: 'SCAN_ERROR', message: 'Découverte des scanners échouée' })
    }
  }

  const handleScan = async () => {
    if (!activeScanner) return
    dispatch({ type: 'START_SCAN' })
    try {
      const res = await sendMessage('START_SCAN', { ip: activeScanner.ip, settings })
      if (!res.success) {
        dispatch({ type: 'SCAN_ERROR', message: res.error })
        return
      }
      dispatch({ type: 'SCAN_DONE', record: res.record })
    } catch (e) {
      dispatch({ type: 'SCAN_ERROR', message: e instanceof Error ? e.message : 'Erreur inconnue' })
    }
  }

  const handleCopy = async () => {
    if (!currentScan || currentScan.mimeType === 'application/pdf') return
    const res = await fetch(currentScan.dataUrl)
    const blob = await res.blob()
    await navigator.clipboard.write([new ClipboardItem({ [currentScan.mimeType]: blob })])
  }

  const handleDownload = () => {
    if (!currentScan) return
    const ext = currentScan.mimeType === 'application/pdf' ? 'pdf'
      : currentScan.mimeType === 'image/png' ? 'png'
      : 'jpg'
    const a = document.createElement('a')
    a.href = currentScan.dataUrl
    a.download = `scan-${Date.now()}.${ext}`
    a.click()
  }

  const handleOpenPreview = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/preview/index.html') })
  }

  const statusMessage =
    status === 'discovering' ? 'Recherche de scanners...' :
    status === 'scanning' ? 'Scan en cours...' :
    status === 'done' ? 'Scan terminé !' :
    status === 'error' ? (errorMessage ?? 'Erreur') :
    ''

  return (
    <div class="container">
      <div class="header">
        <h1>Easy Scan</h1>
        <button class="options-btn" onClick={() => chrome.runtime.openOptionsPage()} title="Options">⚙️</button>
      </div>
      <section class="main-section">
        <ScannerSelector
          scanners={scanners}
          activeId={activeScannerId}
          onSelect={handleSelectScanner}
          onDiscover={handleDiscover}
          discovering={status === 'discovering'}
        />
        <ScanControls settings={settings} onUpdate={handleUpdateSettings} />
        <ScanButton
          onScan={handleScan}
          disabled={!activeScanner}
          scanning={status === 'scanning'}
        />
      </section>
      <section class="result-section">
        <StatusBar message={statusMessage} status={status} />
        <PreviewPanel
          record={currentScan}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onOpenPreview={handleOpenPreview}
        />
      </section>
    </div>
  )
}
