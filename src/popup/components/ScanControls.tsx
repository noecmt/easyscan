import type { ScanSettings, DPI, ColorMode, ScanFormat } from '../../core/types'

interface Props {
  settings: ScanSettings
  onUpdate: (partial: Partial<ScanSettings>) => void
}

export function ScanControls({ settings, onUpdate }: Props) {
  return (
    <div class="controls-row">
      <select
        value={settings.dpi}
        onChange={e => onUpdate({ dpi: Number((e.target as HTMLSelectElement).value) as DPI })}
        title="Résolution"
      >
        <option value={75}>75 DPI</option>
        <option value={150}>150 DPI</option>
        <option value={300}>300 DPI</option>
        <option value={600}>600 DPI</option>
        <option value={1200}>1200 DPI</option>
      </select>

      <select
        value={settings.colorMode}
        onChange={e => onUpdate({ colorMode: (e.target as HTMLSelectElement).value as ColorMode })}
        title="Mode couleur"
      >
        <option value="RGB24">Couleur</option>
        <option value="Grayscale8">Gris</option>
        <option value="BlackAndWhite1">N&B</option>
      </select>

      <select
        value={settings.format}
        onChange={e => onUpdate({ format: (e.target as HTMLSelectElement).value as ScanFormat })}
        title="Format"
      >
        <option value="jpeg">JPEG</option>
        <option value="png">PNG</option>
        <option value="pdf">PDF</option>
      </select>
    </div>
  )
}
