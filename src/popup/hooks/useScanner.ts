import { useEffect } from 'preact/hooks'
import { getScanners, getActiveScanner, getSettings } from '../../storage'
import type { SavedScanner, ScanSettings } from '../../core/types'

type OnLoadCallback = (
  scanners: SavedScanner[],
  settings: ScanSettings,
  activeId: string | null
) => void

export function useScanner(onLoad: OnLoadCallback): void {
  useEffect(() => {
    Promise.all([getScanners(), getActiveScanner(), getSettings()]).then(
      ([scanners, active, settings]) => {
        onLoad(scanners, settings, active?.id ?? null)
      }
    )
  }, [])
}
