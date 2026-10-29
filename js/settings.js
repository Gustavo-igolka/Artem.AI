import { KEYS } from './config.js'

const DEFAULTS = {
  mode: 'auto',   // auto | neural | classic
  temp: 0.7,      // температура LSTM
  len: 200,       // максимум символов ответа LSTM
  learn: true,    // учиться словам на сообщениях пользователя
}

export const settings = { ...DEFAULTS }

try {
  const raw = localStorage.getItem(KEYS.settings)
  if (raw) Object.assign(settings, JSON.parse(raw))
} catch (e) { /* localStorage недоступен — живём с настройками по умолчанию */ }

export function saveSettings() {
  try { localStorage.setItem(KEYS.settings, JSON.stringify(settings)) } catch (e) {}
}
