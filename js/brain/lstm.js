// Символьная LSTM-нейросеть Артёма (TensorFlow.js). Архитектура как в V6:
// LSTM(128) → Dropout(0.2) → LSTM(128) → Dropout(0.2) → Dense(vocab, softmax).
// Модуль не трогает DOM — только считает.

import { KEYS, BASE_CHARS } from '../config.js'

const T = () => globalThis.tf

export class NeuralBrain {
  constructor() {
    this.model = null
    this.vocab = []
    this.c2i = {}
    this.seqLen = 40
    this.epochs = 0
    this.loss = null
    this.lossHistory = []
    this.training = false
    this.stopFlag = false
  }

  get available() { return !!T() }
  get ready() { return !!this.model && this.vocab.length > 0 }
  get vocabSize() { return this.vocab.length }
  get params() {
    if (!this.model) return 0
    return this.model.trainableWeights.reduce((s, w) => s + w.shape.reduce((a, b) => a * b, 1), 0)
  }
  get backend() { return T() ? T().getBackend() : '—' }

  setVocab(chars) {
    this.vocab = [...chars]
    this.c2i = {}
    this.vocab.forEach((c, i) => { this.c2i[c] = i })
  }

  _idx(ch) {
    const i = this.c2i[ch]
    if (i !== undefined) return i
    return this.c2i[' '] ?? 0   // неизвестный символ → пробел
  }

  build() {
    const tf = T()
    if (this.model) { try { this.model.dispose() } catch (e) {} this.model = null }
    const m = tf.sequential()
    m.add(tf.layers.lstm({ units: 128, returnSequences: true, inputShape: [this.seqLen, this.vocabSize] }))
    m.add(tf.layers.dropout({ rate: 0.2 }))
    m.add(tf.layers.lstm({ units: 128, returnSequences: false }))
    m.add(tf.layers.dropout({ rate: 0.2 }))
    m.add(tf.layers.dense({ units: this.vocabSize, activation: 'softmax' }))
    m.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy' })
    this.model = m
    return m
  }

  // Дообучать можно модель с тем же окном и стандартным алфавитом (старые V6-модели учатся заново).
  canContinue(seqLen) {
    return this.ready && this.seqLen === seqLen && this.vocab.join('') === BASE_CHARS
  }

  async train(text, opts = {}) {
    const tf = T()
    const {
      epochs = 10, batchSize = 32, seqLen = 40, stride = 2, fresh = false,
      onBatch = () => {}, onEpoch = () => {},
    } = opts

    await tf.ready()
    const continuing = !fresh && this.canContinue(seqLen)
    if (!continuing) {
      this.seqLen = seqLen
      this.setVocab(BASE_CHARS)
      this.epochs = 0
      this.loss = null
      this.lossHistory = []
      this.build()
    }

    const ids = Array.from(text).map(c => this._idx(c))
    const V = this.vocabSize, L = this.seqLen
    if (ids.length < L + batchSize) throw new Error('Текст слишком короткий для таких настроек')

    const starts = []
    for (let i = 0; i + L < ids.length; i += stride) starts.push(i)

    this.training = true
    this.stopFlag = false
    try {
      for (let ep = 0; ep < epochs && !this.stopFlag; ep++) {
        shuffle(starts)
        let sum = 0, n = 0
        for (let b = 0; b < starts.length && !this.stopFlag; b += batchSize) {
          const batch = starts.slice(b, b + batchSize)
          const x = new Float32Array(batch.length * L * V)
          const y = new Float32Array(batch.length * V)
          batch.forEach((s, k) => {
            for (let t = 0; t < L; t++) x[k * L * V + t * V + ids[s + t]] = 1
            y[k * V + ids[s + L]] = 1
          })
          const xT = tf.tensor3d(x, [batch.length, L, V])
          const yT = tf.tensor2d(y, [batch.length, V])
          let loss
          try { loss = await this.model.trainOnBatch(xT, yT) } finally { xT.dispose(); yT.dispose() }
          loss = Array.isArray(loss) ? loss[0] : loss
          sum += loss; n++
          onBatch({ epoch: ep + 1, epochs, frac: (ep + b / starts.length) / epochs, loss: sum / n })
          await tf.nextFrame()   // отдаём поток браузеру, интерфейс не зависает
        }
        if (n > 0 && !this.stopFlag) {
          this.loss = sum / n
          this.lossHistory.push(this.loss)
          this.epochs++
          onEpoch({ epoch: ep + 1, epochs, loss: this.loss })
        }
      }
    } finally {
      this.training = false
    }
    return { continuing }
  }

  stop() { this.stopFlag = true }

  async generate(prompt, opts = {}) {
    const tf = T()
    const { maxChars = 200, temperature = 0.7, topK = 6, stopAt = null, onChar = null } = opts
    if (!this.ready) return ''
    const V = this.vocabSize, L = this.seqLen
    const pad = this.c2i['\n'] ?? this.c2i[' '] ?? 0

    let seq = Array.from(prompt).map(c => this._idx(c)).slice(-L)
    while (seq.length < L) seq.unshift(pad)

    let out = ''
    for (let i = 0; i < maxChars; i++) {
      const x = new Float32Array(L * V)
      for (let t = 0; t < L; t++) x[t * V + seq[t]] = 1
      const xT = tf.tensor3d(x, [1, L, V])
      const pred = this.model.predict(xT)
      const probs = await pred.data()
      xT.dispose(); pred.dispose()

      const idx = sample(probs, temperature, topK)
      const ch = this.vocab[idx] ?? ''
      if (stopAt && ch === stopAt) break
      out += ch
      seq.push(idx); seq.shift()
      if (onChar) onChar(out)
    }
    return out
  }

  // Ответ в формате диалога, на котором учились: «Ты: …\nАртём:» → реплика до конца строки.
  async chat(userText, opts = {}) {
    const hasNL = '\n' in this.c2i
    const prompt = `Ты: ${userText.replace(/\s+/g, ' ').trim()}\nАртём:`
    const raw = await this.generate(prompt, { ...opts, stopAt: hasNL ? '\n' : null })
    return raw.split('\n')[0].trim()
  }

  /* ── локальное сохранение ── */
  async save() {
    await this.model.save(KEYS.model)
    localStorage.setItem(KEYS.vocab, JSON.stringify(this.vocab))
    localStorage.setItem(KEYS.meta, JSON.stringify({
      seqLen: this.seqLen, vocabSize: this.vocabSize,
      trainedEpochs: this.epochs, lastLoss: this.loss, lossHistory: this.lossHistory,
    }))
  }

  hasSaved() {
    try { return !!localStorage.getItem(KEYS.vocab) } catch (e) { return false }
  }

  async load() {
    const tf = T()
    const savedVocab = localStorage.getItem(KEYS.vocab)
    if (!savedVocab) return false
    this.setVocab(JSON.parse(savedVocab))
    const meta = JSON.parse(localStorage.getItem(KEYS.meta) || '{}')
    this.seqLen = meta.seqLen || 40
    this.epochs = meta.trainedEpochs || 0
    this.loss = meta.lastLoss ?? null
    this.lossHistory = meta.lossHistory || []
    if (this.model) { try { this.model.dispose() } catch (e) {} this.model = null }
    this.model = await tf.loadLayersModel(KEYS.model)
    this.model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy' })
    return true
  }

  wipe() {
    const tf = T()
    if (this.model) { try { this.model.dispose() } catch (e) {} this.model = null }
    try { localStorage.removeItem(KEYS.vocab); localStorage.removeItem(KEYS.meta) } catch (e) {}
    try { tf.io.removeModel(KEYS.model) } catch (e) {}
    this.vocab = []; this.c2i = {}
    this.epochs = 0; this.loss = null; this.lossHistory = []; this.seqLen = 40
  }

  /* ── обмен весами с ОБПАО (формат совместим с V6) ── */
  async exportPack() {
    const weights = this.model.getWeights()
    const arrays = await Promise.all(weights.map(w => w.data()))
    const shapes = weights.map(w => [...w.shape])
    const total = arrays.reduce((s, a) => s + a.length, 0)
    const packed = new Float32Array(total)
    let off = 0
    for (const a of arrays) { packed.set(a, off); off += a.length }
    const bytes = new Uint8Array(packed.buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return {
      vocab: this.vocab,
      meta: { seqLen: this.seqLen, vocabSize: this.vocabSize, trainedEpochs: this.epochs, lastLoss: this.loss, weightShapes: shapes },
      weights_b64: btoa(binary),
    }
  }

  importPack(pack) {
    const tf = T()
    const meta = pack.meta || {}
    this.seqLen = meta.seqLen || 40
    this.setVocab(pack.vocab || [])
    this.epochs = meta.trainedEpochs || 0
    this.loss = meta.lastLoss ?? null
    this.lossHistory = []
    this.build()

    const bin = atob(pack.weights_b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const flat = new Float32Array(bytes.buffer)

    let off = 0
    const tensors = this.model.getWeights().map(w => {
      const size = w.shape.reduce((a, b) => a * b, 1)
      if (off + size > flat.length) throw new Error('Веса из ОБПАО не подходят к архитектуре')
      const t = tf.tensor(flat.slice(off, off + size), w.shape)
      off += size
      return t
    })
    this.model.setWeights(tensors)
    tensors.forEach(t => t.dispose())
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
}

// Температура + top-k: берём только k самых вероятных символов, чтобы речь не рассыпалась.
function sample(probs, temperature, topK) {
  const idx = Array.from(probs, (p, i) => i).sort((a, b) => probs[b] - probs[a]).slice(0, topK)
  const t = Math.max(temperature, 0.05)
  const w = idx.map(i => Math.exp(Math.log(Math.max(probs[i], 1e-10)) / t))
  const sum = w.reduce((a, b) => a + b, 0)
  let r = Math.random() * sum
  for (let k = 0; k < idx.length; k++) { r -= w[k]; if (r <= 0) return idx[k] }
  return idx[idx.length - 1]
}

export const neural = new NeuralBrain()
