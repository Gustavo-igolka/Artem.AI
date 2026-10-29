// «Память» Артёма: пары вопрос → ответ из data/dialogue.txt и поиск по смыслу (tf-idf + косинус).
//
// Формат файла:
//   # комментарий
//   Ты: вариант вопроса
//   Ты: ещё вариант вопроса
//   Артём: вариант ответа
//   Артём: ещё вариант ответа
//   (пустая строка — конец блока)
// Блок «Ты: *» — запасные фразы, когда ничего не подошло.
// В ответах можно использовать {time} и {date}.

import { tokens } from './text.js'

const FALLBACK_SEED = `
Ты: привет
Ты: здравствуй
Артём: Привет! Я Артём. Файл с памятью (data/dialogue.txt) не загрузился, поэтому знаю совсем чуть-чуть.
Артём: Здравствуй! Открой сайт через GitHub Pages, тогда я вспомню всё остальное.

Ты: *
Артём: Не уверен, что понял. Скажи иначе?
`

const THRESHOLD = 0.3

export function parseDialogue(text) {
  const blocks = []
  let cur = null
  const flush = () => { if (cur && cur.qs.length && cur.as.length) blocks.push(cur); cur = null }

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('#')) continue
    const m = line.match(/^(Ты|Артём|Артем)\s*:\s*(.*)$/i)
    if (!m) continue
    if (!cur) cur = { qs: [], as: [] }
    const who = m[1].toLowerCase()
    if (who === 'ты') cur.qs.push(m[2]); else cur.as.push(m[2])
  }
  flush()
  return blocks
}

export class Dialogue {
  constructor() {
    this.blocks = []      // обычные блоки
    this.fallbacks = []   // ответы блока «Ты: *»
    this.entries = []     // { block, q, vec, norm }
    this.idf = new Map()
    this.lastAnswer = ''
  }

  load(text) {
    const all = parseDialogue(text)
    this.blocks = []
    this.fallbacks = []
    for (const b of all) {
      if (b.qs.length === 1 && b.qs[0].trim() === '*') this.fallbacks.push(...b.as)
      else this.blocks.push(b)
    }
    this._index()
    return this.blocks.length
  }

  _index() {
    const docs = []
    this.blocks.forEach((block, bi) => {
      for (const q of block.qs) {
        const toks = tokens(q)
        if (toks.length) docs.push({ bi, q, toks })
      }
    })
    const df = new Map()
    for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) || 0) + 1)
    const N = docs.length || 1
    this.idf = new Map()
    for (const [t, c] of df) this.idf.set(t, Math.log(1 + N / c))

    this.entries = docs.map(d => {
      const vec = this._vector(d.toks)
      return { block: d.bi, q: d.q, vec, norm: norm(vec) }
    })
  }

  _vector(toks) {
    const v = new Map()
    for (const t of toks) v.set(t, (v.get(t) || 0) + 1)
    for (const [t, c] of v) v.set(t, c * (this.idf.get(t) || Math.log(1 + this.entries.length + 1)))
    return v
  }

  // Возвращает { answer, score } или null, если подходящего ответа нет.
  match(userText) {
    const toks = tokens(userText)
    if (!toks.length || !this.entries.length) return null
    const qv = this._vector(toks)
    const qn = norm(qv)
    if (!qn) return null

    const bestPerBlock = new Map()
    for (const e of this.entries) {
      if (!e.norm) continue
      let dot = 0
      for (const [t, w] of qv) { const w2 = e.vec.get(t); if (w2) dot += w * w2 }
      const score = dot / (qn * e.norm)
      if (score > (bestPerBlock.get(e.block) || 0)) bestPerBlock.set(e.block, score)
    }
    let best = 0
    for (const s of bestPerBlock.values()) if (s > best) best = s
    if (best < THRESHOLD) return null

    // Из почти равных по счёту блоков берём случайный — ответы не будут одинаковыми.
    const candidates = [...bestPerBlock].filter(([, s]) => s >= best * 0.9).map(([b]) => b)
    const block = this.blocks[candidates[Math.floor(Math.random() * candidates.length)]]
    return { answer: this._pick(block.as), score: best }
  }

  fallback() {
    const pool = this.fallbacks.length ? this.fallbacks : ['Не уверен, что понял. Скажи иначе?']
    return this._pick(pool)
  }

  _pick(list) {
    let pool = list.length > 1 ? list.filter(a => a !== this.lastAnswer) : list
    if (!pool.length) pool = list
    const raw = pool[Math.floor(Math.random() * pool.length)]
    this.lastAnswer = raw
    return fillPlaceholders(raw)
  }

  // Текст для обучения LSTM: чистые пары «Ты: … / Артём: …».
  trainingText() {
    const out = []
    const add = (qs, as) => {
      // Не больше трёх формулировок вопроса на блок: текст короче, обучение быстрее.
      const n = Math.max(as.length, Math.min(qs.length, 3))
      for (let i = 0; i < n; i++) out.push(`Ты: ${qs[i % qs.length]}\nАртём: ${as[i % as.length]}\n`)
    }
    for (const b of this.blocks) add(b.qs, b.as)
    for (const a of this.fallbacks) out.push(`Ты: ...\nАртём: ${a}\n`)
    return out.join('\n')
  }

  // Все реплики Артёма — материал для цепочек слов.
  answersText() {
    const lines = []
    for (const b of this.blocks) lines.push(...b.as)
    lines.push(...this.fallbacks)
    return lines.join('\n')
  }
}

function norm(vec) {
  let s = 0
  for (const w of vec.values()) s += w * w
  return Math.sqrt(s)
}

export function fillPlaceholders(s) {
  const now = new Date()
  return s
    .replace(/\{time\}/g, now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    .replace(/\{date\}/g, now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))
}

export { FALLBACK_SEED }
