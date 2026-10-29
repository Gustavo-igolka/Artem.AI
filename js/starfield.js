// Звёздный фон.
export function startStarfield() {
  const canvas = document.getElementById('starfield')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let W, H, stars = []

  function resize() {
    W = canvas.width = window.innerWidth
    H = canvas.height = window.innerHeight
    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.1 + 0.2,
      a: Math.random(), da: (Math.random() - 0.5) * 0.005,
    }))
  }
  window.addEventListener('resize', resize)
  resize()

  ;(function draw() {
    ctx.clearRect(0, 0, W, H)
    for (const s of stars) {
      s.a += s.da
      if (s.a < 0.05) s.da = Math.abs(s.da)
      if (s.a > 0.85) s.da = -Math.abs(s.da)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(140,210,255,${s.a})`
      ctx.fill()
    }
    requestAnimationFrame(draw)
  })()
}
