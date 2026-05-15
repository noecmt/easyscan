type Messages = Record<string, { message: string; placeholders?: Record<string, { content: string }> }>

let _messages: Messages = {}

export async function initI18n(): Promise<void> {
  const { lang } = await chrome.storage.local.get('lang')
  const supported = ['en', 'fr']

  let target: string
  if (lang && supported.includes(lang)) {
    target = lang
  } else {
    const uiLang = chrome.i18n.getUILanguage().split('-')[0]
    target = supported.includes(uiLang) ? uiLang : 'en'
  }

  try {
    const url = chrome.runtime.getURL(`_locales/${target}/messages.json`)
    const res = await fetch(url)
    _messages = await res.json()
  } catch {
    _messages = {}
  }
}

export function t(key: string, subs?: string[]): string {
  const entry = _messages[key]
  if (!entry) return chrome.i18n.getMessage(key, subs) || key

  let msg = entry.message

  if (entry.placeholders && subs) {
    for (const [name, ph] of Object.entries(entry.placeholders)) {
      let value = ph.content
      subs.forEach((sub, i) => { value = value.replace(`$${i + 1}`, sub) })
      msg = msg.replace(new RegExp(`\\$${name}\\$`, 'gi'), value)
    }
  }

  return msg || key
}

export function applyI18n(root: Document | Element = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const msg = t(el.dataset.i18n!)
    if (msg) el.textContent = msg
  })
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => {
    const msg = t(el.dataset.i18nTitle!)
    if (msg) el.title = msg
  })
  root.querySelectorAll<HTMLImageElement>('[data-i18n-alt]').forEach(el => {
    const msg = t(el.dataset.i18nAlt!)
    if (msg) el.alt = msg
  })
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach(el => {
    const msg = t(el.dataset.i18nPlaceholder!)
    if (msg) el.placeholder = msg
  })
}
