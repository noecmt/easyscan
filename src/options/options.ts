import {
  getScanners, saveScanner, deleteScanner,
  getActiveScanner, setActiveScanner,
  getSettings, saveSettings,
  generateId,
} from '../storage/index'
import type { SavedScanner, DPI, ColorMode, ScanFormat, DiscoveredScanner } from '../core/types'

// ─── State ────────────────────────────────────────────────────

let discoveredCache: DiscoveredScanner[] = []

// ─── Utilities ────────────────────────────────────────────────

function sendMessage<T>(message: object): Promise<T> {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve))
}

function showStatus(id: string, msg: string, type: 'success' | 'error' | 'info'): void {
  const el = document.getElementById(id)!
  el.textContent = msg
  el.className = `status ${type}`
  if (type === 'success') setTimeout(() => { el.textContent = ''; el.className = 'status' }, 2000)
}

// ─── Scanner list rendering ────────────────────────────────────

function createScannerRow(scanner: SavedScanner, isActive: boolean): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'scanner-item'

  const icon = document.createElement('span')
  icon.className = 'scanner-item__icon'
  icon.textContent = '🖨️'

  // Inline-editable name
  const nameSpan = document.createElement('span')
  nameSpan.className = 'scanner-item__name'
  nameSpan.title = 'Click to rename'
  nameSpan.textContent = scanner.name

  nameSpan.addEventListener('click', () => {
    const input = document.createElement('input')
    input.className = 'scanner-item__name-input'
    input.value = scanner.name
    li.replaceChild(input, nameSpan)
    input.focus()

    const commit = async () => {
      const newName = input.value.trim()
      if (newName && newName !== scanner.name) await renameScanner(scanner.id, newName)
      li.replaceChild(nameSpan, input)
      if (newName) nameSpan.textContent = newName
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') { input.blur() }
      if (e.key === 'Escape') { li.replaceChild(nameSpan, input) }
    })
  })

  const ipSpan = document.createElement('span')
  ipSpan.className = 'scanner-item__ip'
  ipSpan.textContent = scanner.ip

  const actions = document.createElement('div')
  actions.className = 'scanner-item__actions'

  if (isActive) {
    const badge = document.createElement('span')
    badge.className = 'badge-active'
    badge.textContent = '✓ Active'
    actions.appendChild(badge)
  } else {
    const setActiveBtn = document.createElement('button')
    setActiveBtn.className = 'btn-set-active'
    setActiveBtn.textContent = 'Set active'
    setActiveBtn.addEventListener('click', () => handleSetActive(scanner.id))
    actions.appendChild(setActiveBtn)
  }

  const testBtn = document.createElement('button')
  testBtn.className = 'btn-test'
  testBtn.textContent = 'Test'
  testBtn.addEventListener('click', () => handleTestScanner(scanner.ip, testBtn))

  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'btn-delete'
  deleteBtn.textContent = 'Delete'
  deleteBtn.addEventListener('click', () => handleDeleteScanner(scanner.id))

  actions.appendChild(testBtn)
  actions.appendChild(deleteBtn)

  li.append(icon, nameSpan, ipSpan, actions)
  return li
}

async function renderScannerList(): Promise<void> {
  const [scanners, active] = await Promise.all([getScanners(), getActiveScanner()])
  const list = document.getElementById('scanner-list')!
  list.innerHTML = ''
  for (const scanner of scanners) {
    list.appendChild(createScannerRow(scanner, scanner.id === active?.id))
  }
}

// ─── Scanner CRUD ─────────────────────────────────────────────

async function addScanner(ip: string, name: string): Promise<void> {
  const scanner: SavedScanner = { id: generateId(), name, ip, lastUsed: Date.now() }
  await saveScanner(scanner)
  await renderScannerList()
  // Reset & hide the add form
  ;(document.getElementById('new-scanner-ip') as HTMLInputElement).value = ''
  ;(document.getElementById('new-scanner-name') as HTMLInputElement).value = ''
  document.getElementById('add-scanner-form')!.classList.add('hidden')
}

async function renameScanner(id: string, newName: string): Promise<void> {
  const scanners = await getScanners()
  const s = scanners.find(s => s.id === id)
  if (!s) return
  await saveScanner({ ...s, name: newName })
}

async function handleDeleteScanner(id: string): Promise<void> {
  await deleteScanner(id)
  const active = await getActiveScanner()
  if (!active) await chrome.storage.local.remove('activeScannerId')
  await renderScannerList()
}

async function handleSetActive(id: string): Promise<void> {
  await setActiveScanner(id)
  await renderScannerList()
}

// ─── Connectivity test ────────────────────────────────────────

async function handleTestScanner(ip: string, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true
  btn.textContent = 'Testing…'
  btn.className = 'btn-test'

  try {
    const res = await sendMessage<{ ok: boolean }>({
      type: 'CONNECTIVITY_TEST',
      payload: { printerUrl: `http://${ip}` },
    })
    btn.textContent = res.ok ? '✓ Online' : '✗ Unreachable'
    btn.classList.add(res.ok ? 'btn-success' : 'btn-error')
  } catch {
    btn.textContent = '✗ Error'
    btn.classList.add('btn-error')
  } finally {
    btn.disabled = false
  }
}

// ─── Discovery ────────────────────────────────────────────────

async function handleDiscover(): Promise<void> {
  const discoverBtn = document.getElementById('discover-btn') as HTMLButtonElement
  discoverBtn.disabled = true
  showStatus('discover-status', 'Searching…', 'info')
  document.getElementById('discover-results')!.classList.add('hidden')
  document.getElementById('discover-name-row')!.classList.add('hidden')

  try {
    const res = await sendMessage<{ ok: boolean; scanners: DiscoveredScanner[] }>({
      type: 'DISCOVER_SCANNERS',
      payload: {},
    })

    if (!res.ok || !res.scanners.length) {
      showStatus('discover-status', 'No scanners found on network', 'error')
      return
    }

    discoveredCache = res.scanners

    const select = document.getElementById('discover-results') as HTMLSelectElement
    select.innerHTML = '<option value="">Select a scanner…</option>'
    for (const s of res.scanners) {
      const opt = document.createElement('option')
      opt.value = s.baseUrl
      opt.textContent = `${s.ip} – ${s.name}`
      select.appendChild(opt)
    }
    select.classList.remove('hidden')
    document.getElementById('discover-name-row')!.classList.remove('hidden')
    showStatus('discover-status', `${res.scanners.length} scanner(s) found`, 'success')
  } catch (e) {
    showStatus('discover-status', `Error: ${(e as Error).message}`, 'error')
  } finally {
    discoverBtn.disabled = false
  }
}

async function handleAddDiscovered(): Promise<void> {
  const select = document.getElementById('discover-results') as HTMLSelectElement
  const baseUrl = select.value
  if (!baseUrl) return

  const ip = new URL(baseUrl).hostname
  const nameInput = document.getElementById('discover-name-input') as HTMLInputElement
  const name = nameInput.value.trim() ||
    discoveredCache.find(s => s.baseUrl === baseUrl)?.name ||
    ip

  await addScanner(ip, name)

  nameInput.value = ''
  select.classList.add('hidden')
  document.getElementById('discover-name-row')!.classList.add('hidden')
  showStatus('discover-status', '', 'info')
}

// ─── Default settings ─────────────────────────────────────────

async function loadSettings(): Promise<void> {
  const settings = await getSettings()
  ;(document.getElementById('dpi') as HTMLSelectElement).value = String(settings.dpi)
  ;(document.getElementById('colorMode') as HTMLSelectElement).value = settings.colorMode
  ;(document.getElementById('format') as HTMLSelectElement).value = settings.format
}

async function saveDefaultSettings(): Promise<void> {
  const dpi = Number((document.getElementById('dpi') as HTMLSelectElement).value) as DPI
  const colorMode = (document.getElementById('colorMode') as HTMLSelectElement).value as ColorMode
  const format = (document.getElementById('format') as HTMLSelectElement).value as ScanFormat
  await saveSettings({ dpi, colorMode, format })
  showStatus('settings-status', 'Saved', 'success')
}

async function resetSettings(): Promise<void> {
  await saveSettings({ dpi: 300, colorMode: 'RGB24', format: 'jpeg' })
  await loadSettings()
  showStatus('settings-status', 'Reset to defaults', 'success')
}

// ─── Version ──────────────────────────────────────────────────

function loadVersion(): void {
  document.getElementById('version')!.textContent = `v${chrome.runtime.getManifest().version}`
}

// ─── Init ─────────────────────────────────────────────────────

async function init(): Promise<void> {
  await renderScannerList()
  await loadSettings()
  loadVersion()

  // Add scanner form
  document.getElementById('add-scanner-btn')!.addEventListener('click', () => {
    document.getElementById('add-scanner-form')!.classList.toggle('hidden')
  })
  document.getElementById('add-scanner-cancel-btn')!.addEventListener('click', () => {
    document.getElementById('add-scanner-form')!.classList.add('hidden')
  })
  document.getElementById('add-scanner-confirm-btn')!.addEventListener('click', async () => {
    const ip = (document.getElementById('new-scanner-ip') as HTMLInputElement).value.trim()
    const name = (document.getElementById('new-scanner-name') as HTMLInputElement).value.trim()
    if (!ip || !name) return
    await addScanner(ip, name)
  })

  // Discovery
  document.getElementById('discover-btn')!.addEventListener('click', handleDiscover)
  document.getElementById('discover-add-btn')!.addEventListener('click', handleAddDiscovered)

  // Settings auto-save
  for (const id of ['dpi', 'colorMode', 'format']) {
    document.getElementById(id)!.addEventListener('change', saveDefaultSettings)
  }
  document.getElementById('reset-btn')!.addEventListener('click', resetSettings)
}

document.addEventListener('DOMContentLoaded', init)
