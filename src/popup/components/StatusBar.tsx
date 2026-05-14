type AppStatus = 'idle' | 'discovering' | 'scanning' | 'done' | 'error'

interface Props {
  message: string
  status: AppStatus
}

export function StatusBar({ message, status }: Props) {
  if (!message) return null

  const cls = status === 'done' ? 'status success'
    : status === 'error' ? 'status error'
    : 'status info'

  return <div class={cls}>{message}</div>
}
