// Мелкие помощники интерфейса: уведомления, вкладки, сообщения, график loss.

export const $ = id => document.getElementById(id)

export function notify(msg) {
  const el = $('notify')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(notify._t)
  notify._t = setTimeout(() => el.classList.remove('show'), 3200)
}

export function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.nav-btn, .mob-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name))
  $('tab-' + name).classList.add('active')
}

// type: user | ai | sys. Возвращает пузырь; source — маленькая подпись «чем отвечено».
export function addMsg(text, type, { typing = false, source = '' } = {}) {
  const chat = $('chat')
  const wrap = document.createElement('div')
  wrap.className = 'msg ' + type
  const col = document.createElement('div')
  col.className = 'msg-col'
  const bub = document.createElement('div')
  bub.className = 'bubble ' + type + (typing ? ' typing' : '')
  bub.textContent = text
  col.appendChild(bub)
  if (source) setSource(bub, source)
  wrap.appendChild(col)
  chat.appendChild(wrap)
  chat.scrollTop = chat.scrollHeight
  return bub
}

export function setSource(bubble, source) {
  let tag = bubble.parentElement.querySelector('.src')
  if (!tag) { tag = document.createElement('div'); tag.className = 'src'; bubble.parentElement.appendChild(tag) }
  tag.textContent = '· ' + source
}

export function setStatus(type, text) {
  $('statusPill').className = 'status-pill ' + type
  $('statusText').textContent = text
}

export function drawLossGraph(history) {
  const canvas = $('lossCanvas')
  if (!canvas) return
  const W = canvas.offsetWidth, H = canvas.offsetHeight
  if (!W || !H) return
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  if (history.length < 2) return

  const min = Math.min(...history), max = Math.max(...history), range = max - min || 1
  ctx.strokeStyle = 'rgba(0,229,255,0.7)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  history.forEach((l, i) => {
    const x = (i / (history.length - 1)) * W
    const y = H - ((l - min) / range) * (H - 10) - 5
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
  ctx.fillStyle = 'rgba(0,229,255,0.06)'
  ctx.fill()
}
