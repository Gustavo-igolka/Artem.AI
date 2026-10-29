// Цепочки Маркова по словам (порядок 2). Учатся на репликах Артёма и на твоих сообщениях.

import { normalize, stem5, words } from './text.js'

const END = '\u0000'

// Слова, которые не задают тему: вопросительные, местоимения, связки.
const NO_SEED = new Set((
  'почему зачем как что кто где когда какой какая какое какие сколько откуда куда ' +
  'ты я мы вы он она они мне меня тебя тебе тобой себя это этот эта эти такое такой ' +
  'есть быть был была было будет можно надо нужно очень тоже еще уже просто ' +
  'расскажи скажи объясни покажи сделай давай'
).split(' '))

export class Markov {
  constructor(order = 2) {
    this.order = order
    this.map = new Map()       // «слово слово» → [следующие слова]
    this.starts = []           // ключи, с которых начинаются предложения
    this.byStem = new Map()    // основа слова → ключи, где оно встречается
  }

  get size() { return this.map.size }

  learn(text) {
    const sentences = String(text).split(/(?<=[.!?…])\s+|\n+/)
    for (const s of sentences) {
      const words = s.trim().split(/\s+/).filter(Boolean)
      if (words.length < this.order + 1) continue
      this.starts.push(words.slice(0, this.order).join(' '))
      for (let i = 0; i <= words.length - this.order; i++) {
        const key = words.slice(i, i + this.order).join(' ')
        const next = i + this.order < words.length ? words[i + this.order] : END
        if (!this.map.has(key)) this.map.set(key, [])
        this.map.get(key).push(next)
        for (const w of key.split(' ')) {
          const st = stem5(normalize(w).replace(/[^a-zа-я0-9]/g, ''))
          if (!st) continue
          if (!this.byStem.has(st)) this.byStem.set(st, new Set())
          this.byStem.get(st).add(key)
        }
      }
    }
  }

  // userText — сообщение пользователя, из него берём слова-затравки.
  // requireSeed: если ни одно слово не встречалось в памяти, ничего не выдаём.
  generate(userText = '', maxWords = 28, requireSeed = false) {
    if (!this.map.size) return null
    let key = null
    const pool = []
    for (const w of words(userText)) {
      if (NO_SEED.has(w)) continue
      const set = this.byStem.get(stem5(w))
      if (set) pool.push(...set)
    }
    if (pool.length) key = pool[Math.floor(Math.random() * pool.length)]
    else if (requireSeed) return null
    else key = this.starts[Math.floor(Math.random() * this.starts.length)]
    if (!key) return null

    const out = key.split(' ')
    for (let i = 0; i < maxWords; i++) {
      const nexts = this.map.get(out.slice(-this.order).join(' '))
      if (!nexts) break
      const w = nexts[Math.floor(Math.random() * nexts.length)]
      if (w === END) break
      out.push(w)
    }
    let text = out.join(' ')
    text = text.charAt(0).toUpperCase() + text.slice(1)
    if (!/[.!?…]$/.test(text)) text += '.'
    return text
  }
}
