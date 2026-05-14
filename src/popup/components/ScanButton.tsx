interface Props {
  onScan: () => void
  disabled: boolean
  scanning: boolean
}

export function ScanButton({ onScan, disabled, scanning }: Props) {
  return (
    <div class="action-row">
      <button class="scan-button" onClick={onScan} disabled={disabled || scanning}>
        {scanning ? 'Scan en cours…' : '🖨️ Scanner'}
      </button>
    </div>
  )
}
