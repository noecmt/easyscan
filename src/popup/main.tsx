import { render } from 'preact'
import { App } from './App'
import { initI18n } from '../utils/i18n'

initI18n().then(() => {
  render(<App />, document.getElementById('app')!)
})
