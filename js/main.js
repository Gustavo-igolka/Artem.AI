import { VERSION, PATHS } from './config.js'
import { settings, saveSettings } from './settings.js'
import { neural } from './brain/lstm.js'
import { dialogue, loadBrain, reply, learnedCount, forgetLearned } from './chat.js'
import * as cloudApi from './cloud.js'
import { $, notify, switchTab, addMsg, setSource, setStatus, drawLossGraph } from './ui.js'
import { startStarfield } from './starfield.js'

let busy = false          // Артём печатает ответ
let memoryOk = true       // удалось ли загрузить data/dialogue.txt

/* ═══════════════ статистика и статус ═══════════════ */
function refreshStats() {
  $('st-memory').textContent = memoryOk ? dialogue.blocks.length + ' тем' : 'мини'
  $('st-vocab').textContent = neural.vocabSize || '—'
  $('st-params').textContent = neural.model ? (neural.params / 1000).toFixed(0) + 'K' : '—'
  $('st-epochs').textContent = neural.epochs
  $('st-loss').textContent = neural.loss ? neural.loss.toFixed(3) : '—'
  $('st-seqlen').textContent = neural.seqLen
  $('st-backend').textContent = neural.backend

  if (neural.training) setStatus('training', 'Обучение…')
  else if (neural.ready) setStatus('trained', 'LSTM обучена')
  else setStatus('untrained', 'LSTM не обучена')

  $('btnSave').disabled = !neural.ready
  $('btnUpload').disabled = !neural.ready || !cloudApi.cloud.user
  $('learnedInfo').textContent = 'Выучено фраз: ' + learnedCount()

  let hint
  if (neural.training) hint = 'Идёт обучение LSTM — пока отвечаю из памяти'
  else if (neural.ready) hint = neural.loss !== null && neural.loss < 1.8 ? 'Память + LSTM активны' : 'Память + слова · LSTM ещё учится (loss > 1.8)'
  else hint = memoryOk ? 'Отвечаю из памяти · LSTM можно обучить во вкладке Train'
                       : 'Файл памяти не загрузился — открой сайт через GitHub Pages'
  $('chatHint').textContent = hint
}

/* ═══════════════ чат ═══════════════ */
function typeOut(bubble, text) {
  return new Promise(resolve => {
    const step = Math.max(1, Math.ceil(text.length / 35))
    let i = 0
    const timer = setInterval(() => {
      i = Math.min(text.length, i + step)
      bubble.textContent = text.slice(0, i)
      $('chat').scrollTop = $('chat').scrollHeight
      if (i >= text.length) { clearInterval(timer); resolve() }
    }, 18)
  })
}

async function send(text) {
  text = text.trim()
  if (!text || busy) return
  busy = true
  $('sendBtn').disabled = true
  $('chips').style.display = 'none'
  addMsg(text, 'user')

  const bubble = addMsg('', 'ai', { typing: true })
  let streamed = false
  try {
    const r = await reply(text, partial => {
      streamed = true
      bubble.textContent = partial
      $('chat').scrollTop = $('chat').scrollHeight
    })
    bubble.classList.remove('typing')
    if (!streamed) await typeOut(bubble, r.text); else bubble.textContent = r.text
    setSource(bubble, r.source)
  } catch (e) {
    bubble.classList.remove('typing')
    bubble.textContent = 'Ой, что-то пошло не так: ' + e.message
  }
  busy = false
  $('sendBtn').disabled = false
  refreshStats()
  $('chat').scrollTop = $('chat').scrollHeight
}

/* ═══════════════ обучение ═══════════════ */
function setProgress(frac, loss, epoch, total) {
  $('progressFill').style.width = (frac * 100).toFixed(1) + '%'
  $('progressText').textContent = `Epoch ${epoch}/${total}`
  $('lossVal').textContent = loss ? loss.toFixed(4) : '—'
}

async function runTraining(text, label) {
  if (!neural.available) { notify('⚠ TensorFlow.js не загрузился — проверь интернет'); return }
  if (neural.training) return

  const num = (id, d) => parseInt($(id).value) || d
  const epochs = num('epochsInput', 20), batchSize = num('batchInput', 32)
  const seqLen = num('seqInput', 40), stride = num('strideInput', 3)

  $('trainBtn').style.display = 'none'
  $('quickBtn').disabled = true
  $('stopBtn').style.display = ''
  $('progressWrap').style.display = ''
  setProgress(0, null, 0, epochs)
  refreshStats()
  notify('🧠 ' + label)
  if (neural.backend === 'cpu') addMsg('⚠ На этом устройстве нет ускорения (бэкенд cpu): обучение будет очень медленным. Лучше запускать на телефоне или ПК с видеокартой.', 'sys')

  try {
    const { continuing } = await neural.train(text, {
      epochs, batchSize, seqLen, stride,
      onBatch: p => setProgress(p.frac, p.loss, p.epoch, p.epochs),
      onEpoch: () => { drawLossGraph(neural.lossHistory); refreshStats() },
    })
    refreshStats()
    drawLossGraph(neural.lossHistory)
    if (neural.epochs > 0) {
      try { await neural.save() } catch (e) { /* не страшно: сохранить можно вручную */ }
      notify(`✅ Готово${continuing ? ' (дообучение)' : ''}! Эпох: ${neural.epochs} · loss ${neural.loss.toFixed(3)}`)
      addMsg(`LSTM обучена: ${neural.epochs} эпох, loss ${neural.loss.toFixed(3)}. Выбери режим «Только LSTM» в настройках, чтобы услышать её голос. В «Авто» она подключается, когда loss опустится ниже 1.8.`, 'sys')
    }
  } catch (e) {
    notify('❌ ' + e.message)
  } finally {
    $('trainBtn').style.display = ''
    $('quickBtn').disabled = false
    $('stopBtn').style.display = 'none'
    refreshStats()
  }
}

/* ═══════════════ ОБПАО ═══════════════ */
function updateCloudUI() {
  const available = cloudApi.cloudAvailable()
  const user = cloudApi.cloud.user
  const st = $('op-status')
  if (!available) { st.textContent = 'Недоступно'; st.className = 'obpao-val warn' }
  else if (user) { st.textContent = 'Online'; st.className = 'obpao-val ok' }
  else { st.textContent = 'Не вошёл'; st.className = 'obpao-val off' }

  $('op-user-row').style.display = user ? 'flex' : 'none'
  $('op-email').textContent = user ? user.email : ''
  $('btnLogin').style.display = available && !user ? '' : 'none'
  $('btnLogout').style.display = user ? '' : 'none'
  $('btnDownloadBase').disabled = !user
  $('btnUpload').disabled = !user || !neural.ready
  if (!user) { $('op-model').textContent = '—'; $('op-model').className = 'obpao-val off' }
}

async function checkBase() {
  const el = $('op-model')
  try {
    const info = await cloudApi.baseModelInfo()
    if (info) {
      const m = info.meta || {}
      el.textContent = `✓ ${m.trainedEpochs || '?'}ep / L${m.lastLoss ? m.lastLoss.toFixed(2) : '?'}`
      el.className = 'obpao-val ok'
    } else { el.textContent = 'Нет'; el.className = 'obpao-val off' }
  } catch (e) { el.textContent = 'Ошибка'; el.className = 'obpao-val warn' }
}

function authMsg(msg, color = 'var(--red)') {
  const el = $('auth-msg'); el.style.color = color; el.textContent = msg
}

async function onSignedIn() {
  $('obpao-auth').classList.add('hidden')
  updateCloudUI(); refreshStats()
  notify('☁️ ОБПАО подключён')
  await checkBase()
}

/* ═══════════════ запуск ═══════════════ */
function bindUI() {
  // навигация
  document.querySelectorAll('.nav-btn, .mob-btn').forEach(b =>
    b.addEventListener('click', () => { switchTab(b.dataset.tab); if (b.dataset.tab === 'train') drawLossGraph(neural.lossHistory) }))

  // чат
  $('sendBtn').addEventListener('click', () => { const t = $('msgInput').value; $('msgInput').value = ''; send(t) })
  $('msgInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const t = $('msgInput').value; $('msgInput').value = ''; send(t) }
  })
  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => send(c.dataset.say)))

  // обучение
  $('quickBtn').addEventListener('click', () => runTraining(dialogue.trainingText(), 'Обучаю LSTM на встроенных диалогах…'))
  $('trainBtn').addEventListener('click', () => {
    const text = $('trainInput').value.trim()
    if (text.length < 300) { notify('⚠ Нужно минимум 300 символов текста'); return }
    runTraining(text, 'Обучаю LSTM на твоём тексте…')
  })
  $('stopBtn').addEventListener('click', () => { neural.stop(); notify('⏹ Останавливаю после батча…') })
  $('loadCorpusBtn').addEventListener('click', () => { $('trainInput').value = dialogue.trainingText(); notify('📄 Диалоги подставлены') })

  // настройки
  $('modeSelect').value = settings.mode
  $('modeSelect').addEventListener('change', e => { settings.mode = e.target.value; saveSettings() })
  $('tempSlider').value = Math.round(settings.temp * 10); $('tempVal').textContent = settings.temp.toFixed(1)
  $('tempSlider').addEventListener('input', e => {
    settings.temp = e.target.value / 10; $('tempVal').textContent = settings.temp.toFixed(1); saveSettings()
  })
  $('lenSlider').value = settings.len; $('lenVal').textContent = settings.len
  $('lenSlider').addEventListener('input', e => {
    settings.len = parseInt(e.target.value); $('lenVal').textContent = settings.len; saveSettings()
  })
  $('learnToggle').checked = settings.learn
  $('learnToggle').addEventListener('change', e => { settings.learn = e.target.checked; saveSettings() })
  $('forgetBtn').addEventListener('click', () => { forgetLearned(); refreshStats(); notify('🧹 Выученное забыто') })

  // модель
  $('btnSave').addEventListener('click', async () => {
    try { await neural.save(); notify('✅ Модель сохранена в браузере') } catch (e) { notify('❌ ' + e.message) }
  })
  $('btnLoad').addEventListener('click', async () => {
    if (!neural.available) { notify('⚠ TensorFlow.js не загружен'); return }
    try {
      const ok = await neural.load()
      notify(ok ? `✅ Загружено: ${neural.epochs} эпох` : '⚠ Сохранённой модели нет')
      drawLossGraph(neural.lossHistory); refreshStats()
    } catch (e) { notify('❌ ' + e.message) }
  })
  $('btnWipe').addEventListener('click', () => {
    if (!confirm('Удалить обученную LSTM?')) return
    neural.wipe(); refreshStats(); drawLossGraph([]); notify('🗑 Модель удалена')
  })

  // ОБПАО
  $('btnLogin').addEventListener('click', () => { authMsg(''); $('obpao-auth').classList.remove('hidden') })
  $('auth-close').addEventListener('click', () => $('obpao-auth').classList.add('hidden'))
  $('auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('auth-login').click() })
  $('auth-login').addEventListener('click', async () => {
    const email = $('auth-email').value.trim(), pass = $('auth-password').value
    if (!email || !pass) { authMsg('Заполните email и пароль'); return }
    authMsg('↻ Вход…', 'var(--yellow)')
    try { await cloudApi.login(email, pass); await onSignedIn() } catch (e) { authMsg('Ошибка: ' + (e.message || 'нет соединения')) }
  })
  $('auth-register').addEventListener('click', async () => {
    const email = $('auth-email').value.trim(), pass = $('auth-password').value
    if (!email || !pass) { authMsg('Заполните email и пароль'); return }
    if (pass.length < 6) { authMsg('Пароль минимум 6 символов'); return }
    authMsg('↻ Регистрация…', 'var(--yellow)')
    try {
      const user = await cloudApi.register(email, pass)
      if (user) await onSignedIn(); else authMsg('✅ Аккаунт создан! Подтвердите почту и войдите.', 'var(--green)')
    } catch (e) { authMsg('Ошибка: ' + (e.message || 'нет соединения')) }
  })
  $('btnLogout').addEventListener('click', async () => { await cloudApi.logout(); updateCloudUI(); refreshStats(); notify('Вышел из ОБПАО') })
  $('btnDownloadBase').addEventListener('click', async () => {
    if (!neural.available) { notify('⚠ TensorFlow.js не загружен'); return }
    notify('⬇ Скачиваю базовую модель…')
    try {
      neural.importPack(await cloudApi.downloadBase())
      try { await neural.save() } catch (e) {}
      refreshStats()
      addMsg(`☁ Базовая модель из ОБПАО загружена: ${neural.epochs} эпох, loss ${neural.loss ? neural.loss.toFixed(3) : '—'}.`, 'sys')
      notify('✅ Базовая модель загружена')
    } catch (e) { notify('❌ ' + e.message) }
  })
  $('btnUpload').addEventListener('click', async () => {
    if (!neural.ready) return
    notify('☁ Загружаю модель…')
    try { await cloudApi.uploadModel(await neural.exportPack()); notify('✅ Модель загружена в ОБПАО'); await checkBase() }
    catch (e) { notify('❌ ' + e.message) }
  })
}

async function boot() {
  startStarfield()
  bindUI()

  memoryOk = await loadBrain(PATHS.dialogue)
  refreshStats()

  // Приветствие — Артём заговаривает сразу, без всякого обучения.
  const hi = addMsg(
    `ARTEM.AI ${VERSION}\n\nЯ уже могу говорить: отвечаю из памяти и склеиваю фразы из слов. ` +
    `Нажми подсказку внизу или напиши своё.\n\nЧтобы заработала нейросеть LSTM, её нужно обучить:`,
    'sys')
  const btn = document.createElement('button')
  btn.className = 'sbtn green'
  btn.style.marginTop = '8px'
  btn.textContent = '⚡ Обучить LSTM (быстро)'
  btn.addEventListener('click', () => { switchTab('train'); $('quickBtn').click() })
  hi.appendChild(btn)
  if (!memoryOk) addMsg('⚠ Файл data/dialogue.txt не загрузился (открой сайт по ссылке GitHub Pages, а не как файл). Пока отвечаю по минимуму.', 'sys')

  // TensorFlow.js и сохранённая LSTM
  if (neural.available) {
    try { await globalThis.tf.ready() } catch (e) {}
    if (neural.hasSaved()) {
      try { await neural.load(); notify(`✅ LSTM восстановлена: ${neural.epochs} эпох`) } catch (e) { /* битое сохранение — игнорируем */ }
    }
  } else {
    addMsg('TensorFlow.js не загрузился (нет интернета?). Память и слова работают, LSTM пока недоступна.', 'sys')
  }
  refreshStats()

  // Облако
  if (cloudApi.initCloud()) {
    try { if (await cloudApi.restoreSession()) await checkBase() } catch (e) {}
  }
  updateCloudUI()
  refreshStats()
}

boot()
