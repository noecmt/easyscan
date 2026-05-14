import type { SavedScanner } from '../../core/types'

interface Props {
  scanners: SavedScanner[]
  activeId: string | null
  onSelect: (id: string) => void
  onDiscover: () => void
  discovering: boolean
}

export function ScannerSelector({ scanners, activeId, onSelect, onDiscover, discovering }: Props) {
  return (
    <div class="scanner-selector">
      <select
        value={activeId ?? ''}
        onChange={e => onSelect((e.target as HTMLSelectElement).value)}
        disabled={scanners.length === 0}
      >
        {scanners.length === 0
          ? <option value="">Aucun scanner</option>
          : scanners.map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.ip}</option>
            ))
        }
      </select>
      <button onClick={onDiscover} disabled={discovering} class="icon-btn" title="Rechercher">
        {discovering ? '⏳' : '🔍'}
      </button>
    </div>
  )
}
