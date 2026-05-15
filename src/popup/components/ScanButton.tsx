import { t } from '../../utils/i18n'

interface Props {
  onScan: () => void
  disabled: boolean
  scanning: boolean
}

export function ScanButton({ onScan, disabled, scanning }: Props) {
  return (
    <div class="action-row">
      <button class={`scan-button${scanning ? ' scanning' : ''}`} onClick={onScan} disabled={disabled || scanning}>
        {scanning ? t('scanningBtn') : t('scanBtn')}
      </button>
    </div>
  )
}
