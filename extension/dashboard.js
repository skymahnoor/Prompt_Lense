/** PromptLens local dashboard — overview, history, settings. 100% local, no network, MV3-safe. */
(function () {
  'use strict'

  const $ = function (id) {
    return document.getElementById(id)
  }

  // ---------- tabs ----------
  const navBtns = document.querySelectorAll('.nav-btn')
  navBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navBtns.forEach(function (b) {
        b.classList.remove('active')
      })
      btn.classList.add('active')
      document.querySelectorAll('.tab').forEach(function (t) {
        t.classList.remove('active')
      })
      $('tab-' + btn.dataset.tab).classList.add('active')
      if (btn.dataset.tab === 'overview') drawTrend()
    })
  })

  // ---------- protection toggle ----------
  const enabledEl = $('enabled')
  chrome.storage.sync.get({ enabled: true }, function (s) {
    enabledEl.checked = s.enabled !== false
  })
  enabledEl.addEventListener('change', function () {
    chrome.storage.sync.set({ enabled: enabledEl.checked })
  })

  // ---------- data loading ----------
  let events = []

  function load() {
    chrome.storage.local.get({ events: [] }, function (d) {
      events = (d.events || []).slice().reverse() // newest first
      renderOverview()
      renderHistory()
      drawTrend()
    })
  }

  function timeAgo(iso) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return mins + 'm ago'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    return Math.floor(hrs / 24) + 'd ago'
  }

  function esc(s) {
    const d = document.createElement('div')
    d.textContent = s == null ? '' : String(s)
    return d.innerHTML
  }

  function worstSeverity(e) {
    return (e.items || []).reduce(function (a, i) {
      const rank = { critical: 3, high: 2, medium: 1, low: 0 }
      return rank[i.severity] > rank[a] ? i.severity : a
    }, 'low')
  }

  // ---------- overview ----------
  function renderOverview() {
    let masked = 0
    let leaked = 0
    let cancelled = 0
    const typeMap = {}
    const siteMap = {}
    const sevMap = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const e of events) {
      if (e.action === 'masked') masked += e.totalPii || 0
      else if (e.action === 'sent_anyway') leaked += e.totalPii || 0
      else cancelled++
      for (const it of e.items || []) {
        typeMap[it.type] = (typeMap[it.type] || 0) + it.count
        sevMap[it.severity] = (sevMap[it.severity] || 0) + it.count
      }
      siteMap[e.site] = (siteMap[e.site] || 0) + 1
    }
    $('o-total').textContent = String(events.length)
    $('o-masked').textContent = String(masked)
    $('o-leaked').textContent = String(leaked)
    $('o-cancelled').textContent = String(cancelled)
    const exposure = masked + leaked
    $('o-rate').textContent = exposure > 0 ? Math.round((masked / exposure) * 100) + '%' : '—'

    $('o-types').innerHTML = bars(typeMap)
    $('o-sites').innerHTML = bars(siteMap)
    $('o-sev').innerHTML = sevBars(sevMap)

    const sevColor = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--amber)', low: '#94a3b8' }
    const recent = events.slice(0, 8)
    $('o-recent').innerHTML =
      recent.length === 0
        ? '<li><span class="r-text">Nothing yet — intercept a prompt on an AI chat site.</span></li>'
        : recent
            .map(function (e) {
              const worst = worstSeverity(e)
              const types = (e.items || [])
                .map(function (i) {
                  return i.type
                })
                .join(', ')
              const cls = e.action === 'masked' ? 'tag' : e.action === 'sent_anyway' ? 'tag warn' : 'tag cancel'
              const label = e.action === 'masked' ? 'MASKED' : e.action === 'sent_anyway' ? 'SENT' : 'CANCEL'
              return (
                '<li>' +
                '<span class="sev-dot" style="background:' + (sevColor[worst] || '#94a3b8') + '"></span>' +
                '<span class="r-site">' + esc(e.site) + '</span>' +
                '<span class="r-text">' + esc((e.maskedText || '').slice(0, 90)) + '</span>' +
                '<span class="r-text" style="flex:none;max-width:120px">' + esc(types) + '</span>' +
                '<span class="' + cls + '">' + label + '</span>' +
                '<span class="r-time">' + timeAgo(e.createdAt) + '</span>' +
                '</li>'
              )
            })
            .join('')
  }

  function bars(map) {
    const entries = Object.entries(map).sort(function (a, b) {
      return b[1] - a[1]
    })
    if (entries.length === 0) return '<p class="hint">No data yet.</p>'
    const max = entries[0][1] || 1
    return entries
      .slice(0, 7)
      .map(function (pair) {
        return (
          '<div class="bar-row">' +
          '<span class="bar-label">' + esc(pair[0].replace(/_/g, ' ').toLowerCase()) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + (pair[1] / max) * 100 + '%"></div></div>' +
          '<span class="bar-val">' + pair[1] + '</span>' +
          '</div>'
        )
      })
      .join('')
  }

  function sevBars(map) {
    const order = ['critical', 'high', 'medium', 'low']
    const colors = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--amber)', low: '#94a3b8' }
    const total = order.reduce(function (a, k) {
      return a + (map[k] || 0)
    }, 0)
    if (total === 0) return '<p class="hint">No data yet.</p>'
    const max = Math.max.apply(null, order.map(function (k) { return map[k] || 0 }))
    return order
      .map(function (k) {
        const v = map[k] || 0
        return (
          '<div class="bar-row">' +
          '<span class="bar-label"><i class="sev-dot" style="background:' + colors[k] + '"></i>' + k + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + (max ? (v / max) * 100 : 0) + '%;background:' + colors[k] + '"></div></div>' +
          '<span class="bar-val">' + v + '</span>' +
          '</div>'
        )
      })
      .join('')
  }

  // ---------- 14-day trend (canvas, no libs) ----------
  function dayKey(d) {
    return d.toISOString().slice(0, 10)
  }

  function last14() {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      days.push({ key: dayKey(d), label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), masked: 0, leaked: 0, cancelled: 0 })
    }
    return days
  }

  function drawTrend() {
    const canvas = $('o-trend')
    if (!canvas || !canvas.offsetParent) return // tab not visible
    const days = last14()
    for (const e of events) {
      const k = dayKey(new Date(e.createdAt))
      const day = days.find(function (d) {
        return d.key === k
      })
      if (!day) continue
      if (e.action === 'masked') day.masked += e.totalPii || 0
      else if (e.action === 'sent_anyway') day.leaked += e.totalPii || 0
      else day.cancelled++
    }

    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth || 860
    const H = 190
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const padL = 30
    const padR = 8
    const padT = 10
    const padB = 26
    const plotW = W - padL - padR
    const plotH = H - padT - padB
    const max = Math.max(4, Math.max.apply(null, days.map(function (d) {
      return Math.max(d.masked, d.leaked, d.cancelled)
    })))

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.fillStyle = '#6b837c'
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    for (let g = 0; g <= 4; g++) {
      const y = padT + plotH - (g / 4) * plotH
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(W - padR, y)
      ctx.stroke()
      ctx.fillText(String(Math.round((max / 4) * g)), padL - 6, y + 3)
    }

    const slot = plotW / 14
    const bw = Math.min(18, slot * 0.6)
    days.forEach(function (d, i) {
      const cx = padL + slot * i + slot / 2
      // stacked bars: cancelled bottom, masked middle, leaked top
      let y = padT + plotH
      const groups = [
        { v: d.cancelled, c: 'rgba(148,163,184,0.55)' },
        { v: d.masked, c: '#10b981' },
        { v: d.leaked, c: '#f43f5e' },
      ]
      for (const g of groups) {
        if (!g.v) continue
        const h = (g.v / max) * plotH
        y -= h
        ctx.fillStyle = g.c
        roundRect(ctx, cx - bw / 2, y, bw, h, 2)
        ctx.fill()
      }
      ctx.fillStyle = '#6b837c'
      ctx.textAlign = 'center'
      ctx.fillText(i % 2 === 0 ? d.label : '', cx, H - 8)
    })
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  window.addEventListener('resize', function () {
    if (document.getElementById('tab-overview').classList.contains('active')) drawTrend()
  })

  // ---------- history ----------
  function renderHistory() {
    const q = ($('h-search').value || '').toLowerCase()
    const list = events.filter(function (e) {
      return !q || (e.maskedText || '').toLowerCase().includes(q) || (e.site || '').toLowerCase().includes(q)
    })
    $('h-empty').classList.toggle('hidden', list.length > 0)
    const sevColor = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--amber)', low: '#94a3b8' }
    $('h-body').innerHTML = list
      .slice(0, 100)
      .map(function (e) {
        const worst = worstSeverity(e)
        const types = (e.items || [])
          .map(function (i) {
            return i.label + ' ×' + i.count
          })
          .join(', ')
        return (
          '<tr>' +
          '<td>' + new Date(e.createdAt).toLocaleString() + '</td>' +
          '<td>' + esc(e.site) + '</td>' +
          '<td>' + esc(types) + '</td>' +
          '<td><span class="sev"><span class="sev-dot" style="background:' + (sevColor[worst] || '#94a3b8') + '"></span>' + worst + '</span></td>' +
          '<td>' + esc(e.action.replace('_', ' ')) + '</td>' +
          '<td class="mono" title="' + esc(e.maskedText || '') + '">' + esc((e.maskedText || '—').slice(0, 70)) + '</td>' +
          '</tr>'
        )
      })
      .join('')
  }

  $('h-search').addEventListener('input', renderHistory)
  $('h-clear').addEventListener('click', function () {
    if (confirm('Delete all locally stored interception history? This cannot be undone.')) {
      chrome.storage.local.set({ events: [] }, load)
    }
  })

  // ---------- settings: masking style ----------
  const styleSel = $('s-style')
  chrome.storage.sync.get({ maskingStyle: 'placeholder' }, function (s) {
    styleSel.value = s.maskingStyle || 'placeholder'
  })
  styleSel.addEventListener('change', function () {
    chrome.storage.sync.set({ maskingStyle: styleSel.value })
  })

  // ---------- settings: playground ----------
  $('s-testbox').addEventListener('input', function (e) {
    const text = e.target.value
    const out = $('s-testout')
    if (!text || text.length < 4) {
      out.innerHTML = ''
      return
    }
    const items = window.PromptLensPII.scan(text)
    out.innerHTML =
      items.length === 0
        ? '<p class="hint">Clean — nothing flagged.</p>'
        : items
            .map(function (it) {
              return (
                '<div class="t-item">' +
                '<span class="t-type t-' + it.severity + '">' + it.type + '</span>' +
                '<span class="t-val">' + esc(it.value) + ' → ' + esc(it.preview) + '</span>' +
                '</div>'
              )
            })
            .join('')
  })

  // ---------- settings: export / import (file only — never network) ----------
  $('s-export').addEventListener('click', function () {
    chrome.storage.local.get({ events: [] }, function (d) {
      const blob = new Blob([JSON.stringify(d.events, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'promptlens-events-' + new Date().toISOString().slice(0, 10) + '.json'
      a.click()
      URL.revokeObjectURL(a.href)
    })
  })

  $('s-import').addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = function () {
      try {
        const parsed = JSON.parse(reader.result)
        if (!Array.isArray(parsed)) throw new Error('expected a JSON array of events')
        chrome.storage.local.get({ events: [] }, function (d) {
          const merged = (d.events || []).concat(parsed).slice(-1000)
          chrome.storage.local.set({ events: merged }, function () {
            load()
            alert('Imported ' + parsed.length + ' events into local history')
          })
        })
      } catch (err) {
        alert('Import failed: ' + err.message)
      }
    }
    reader.readAsText(file)
  })

  // ---------- boot ----------
  load()
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.events) load()
  })
})()
