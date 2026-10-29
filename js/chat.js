// Как Артём выбирает ответ: память → LSTM → цепочки слов → запасная фраза.

import { settings } from './settings.js'
import { KEYS } from './config.js'
import { neural } from './brain/lstm.js'
import { Dialogue, FALLBACK_SEED, fillPlaceholders } from './brain/dialogue.js'
import { Markov } from './brain/markov.js'

export const dialogue = new Dialogue()
export const markov = new Markov(2)

const MAX_LEARNED = 300
const LSTM_MAX_LOSS = 1.8   // loss выше — LSTM ещё «сырая», в режиме «Авто» не используем
let learned = []

export async function loadBrain(dialogueUrl) {
  let ok = true
  try {
    const res = await fetch(dialogueUrl, { cache: 'no-cache' })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    dialogue.load(await res.text())
  } catch (e) {
    ok = false
    dialogue.load(FALLBACK_SEED)
  }
  markov.learn(dialogue.answersText())
  try { learned = JSON.parse(localStorage.getItem(KEYS.learned) || '[]') } catch (e) { learned = [] }
  learned.forEach(s => markov.learn(s))
  return ok
}

export function learnedCount() { return learned.length }

export function forgetLearned() {
  learned = []
  try { localStorage.removeItem(KEYS.learned) } catch (e) {}
  // Цепочки пересобираем только из базовой памяти.
  markov.map.clear(); markov.starts = []; markov.byStem.clear()
  markov.learn(dialogue.answersText())
}

function learnFrom(text) {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!settings.learn || clean.endsWith('?') || clean.split(' ').length < 3) return
  learned.push(clean)
  if (learned.length > MAX_LEARNED) learned.shift()
  markov.learn(clean)
  try { localStorage.setItem(KEYS.learned, JSON.stringify(learned)) } catch (e) {}
}

// onStream(текстДоСейчас) вызывается, пока LSTM печатает ответ.
// Возвращает { text, source } — source: память | LSTM | слова | система
export async function reply(userText, onStream) {
  const text = userText.trim()
  const mode = settings.mode
  let result = null

  if (mode !== 'neural') {
    const hit = dialogue.match(text)
    if (hit) result = { text: hit.answer, source: 'память' }
  }

  if (!result && mode !== 'classic') {
    // В «Авто» недоученную сеть не пускаем: сырая LSTM пишет бессвязные буквы.
    const goodEnough = mode === 'neural' || (neural.loss !== null && neural.loss < LSTM_MAX_LOSS)
    if (neural.ready && !neural.training && goodEnough) {
      try {
        const out = await neural.chat(text, {
          maxChars: settings.len, temperature: settings.temp, onChar: onStream,
        })
        if (out.length >= 2) result = { text: fillPlaceholders(out), source: 'LSTM' }
      } catch (e) { /* LSTM не справилась — идём дальше по цепочке */ }
    } else if (mode === 'neural') {
      result = {
        text: neural.training
          ? 'Сейчас идёт обучение LSTM, подожди немного или переключи режим на «Авто».'
          : 'LSTM-мозг ещё не обучен. Открой Train и нажми «Быстрый старт», или переключи режим на «Авто».',
        source: 'система',
      }
    }
  }

  if (!result) {
    const m = markov.generate(text, 28, true)
    if (m) result = { text: m, source: 'слова' }
  }

  if (!result) result = { text: dialogue.fallback(), source: 'память' }

  learnFrom(text)
  return result
}
