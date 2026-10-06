/**
 * PromptLens content script
 * Watches prompt editors on AI chat sites. When the user tries to send a
 * prompt containing PII, it blocks the send, shows a warning, and — on
 * acceptance — masks/replaces the PII before the prompt leaves the browser.
 */
(function () {
  'use strict'
  const PII = window.PromptLensPII

  const SITE = location.hostname.replace(/^www\./, '')

  // ---------- settings ----------
  const settings = { enabled: true, maskingStyle: 'placeholder' }
  function loadSettings() {
    try {
      chrome.storage.sync.get({ enabled: true, maskingStyle: 'placeholder' }, function (s) {
        settings.enabled = s.enabled !== false
        settings.maskingStyle = s.maskingStyle || 'placeholder'
      })
    } catch (e) {}
  }
  loadSettings()
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'sync') {
        if (changes.enabled) settings.enabled = changes.enabled.newValue !== false
        if (changes.maskingStyle) settings.maskingStyle = changes.maskingStyle.newValue || 'placeholder'
      }
    })
  } catch (e) {}

  // ---------- site discovery ----------
  const EDITOR_SELECTORS = [
    'textarea[data-id="root"]', // ChatGPT
    'div#prompt-textarea[contenteditable="true"]', // ChatGPT new
    'div.ProseMirror[contenteditable="true"]', // Claude
    'div.ql-editor[contenteditable="true"]', // Gemini
    'div[contenteditable="true"][role="textbox"]', // generic rich editor
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="ask" i]',
    'textarea[placeholder*="prompt" i]',
    'textarea',
  ]

  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]',
    'button[data-button-id="send"]',
    'button[type="submit"]',
    '#send-button',
  ]

  function visible(el) {
    if (!el) return false
    const rects = el.getClientRects()
    return rects.length > 0 && el.offsetParent !== null
  }

  function findEditor() {
    for (const sel of EDITOR_SELECTORS) {
      const list = document.querySelectorAll(sel)
      for (let i = list.length - 1; i >= 0; i--) {
        if (visible(list[i])) return list[i]
      }
    }
    return null
  }

  function findSendButton(fromEl) {
    if (fromEl) {
      const btn = fromEl.closest && fromEl.closest('button')
      if (btn && matchesSend(btn)) return btn
    }
    for (const sel of SEND_SELECTORS) {
      const list = document.querySelectorAll(sel)
      for (let i = list.length - 1; i >= 0; i--) {
        if (visible(list[i])) return list[i]
      }
    }
    return null
  }

  function matchesSend(btn) {
    return SEND_SELECTORS.some(function (sel) {
      try {
        return btn.matches(sel)
      } catch (e) {
        return false
      }
    })
  }

  // ---------- read / write editor text ----------
  function getText(el) {
    if (!el) return ''
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value
    return el.innerText || el.textContent || ''
  }

  function setText(el, text) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set
      if (setter) setter.call(el, text)
      else el.value = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
    let ok = false
    try {
      ok = document.execCommand('insertText', false, text)
    } catch (e) {
      ok = false
    }
    if (!ok) {
      el.textContent = text
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
    }
  }

  // ---------- state ----------
  const state = { open: false, bypass: false, pendingButton: null }

  // ---------- event logging ----------
  function summarize(items) {
    const map = {}
    for (const it of items) {
      if (!map[it.type]) {
        map[it.type] = { type: it.type, label: it.label, severity: it.severity, count: 0, samples: [] }
      }
      map[it.type].count++
      if (map[it.type].samples.length < 3) map[it.type].samples.push(it.preview)
    }
    return Object.values(map)
  }

  function logEvent(action, items, maskedText) {
    if (!items.length) return
    const sevRank = { critical: 3, high: 2, medium: 1, low: 0 }
    const severity = items.reduce(function (acc, i) {
      return sevRank[i.severity] > sevRank[acc] ? i.severity : acc
    }, 'low')
    const event = {
      clientId: (crypto.randomUUID && crypto.randomUUID()) || 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
      site: SITE,
      url: location.href.slice(0, 300),
      action: action,
      totalPii: items.length,
      severity: severity,
      items: summarize(items),
      maskedText: (maskedText || '').slice(0, 2000),
    }
    try {
      // stored ONLY in this browser profile's local storage — never transmitted
      chrome.storage.local.get({ events: [] }, function (data) {
        let events = data.events || []
        events.push(event)
        if (events.length > 1000) events = events.slice(-1000)
        chrome.storage.local.set({ events: events })
      })
    } catch (e) {}
    try {
      chrome.runtime.sendMessage({ type: 'pl-event', event: event })
    } catch (e) {}
  }

  // ---------- interception ----------
  function onCapture(e) {
    if (!settings.enabled || state.open || state.bypass) return
    // only keyboard-Enter counts (not shift/im composition); clicks need a send-ish button
    const isEnter = e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey && !e.isComposing
    let editor = null
    let sendBtn = null

    if (isEnter) {
      editor = e.target && e.target.closest ? e.target.closest('[contenteditable="true"], textarea') : null
      if (!editor) return
      sendBtn = findSendButton()
    } else if (e.type === 'click') {
      sendBtn = e.target && e.target.closest ? e.target.closest('button') : null
      if (!sendBtn || !matchesSend(sendBtn)) return
      editor = findEditor()
    } else {
      return
    }

    if (!editor) return
    const text = getText(editor)
    if (!text || text.trim().length < 4) return

    const items = PII.scan(text)
    if (!items.length) return // clean — let it pass untouched

    // block the send, remember how to re-trigger it
    e.preventDefault()
    e.stopImmediatePropagation()
    state.pendingButton = sendBtn || findSendButton()
    openModal(editor, items, text)
  }

  document.addEventListener('keydown', onCapture, true)
  document.addEventListener('click', onCapture, true)

  function retriggerSend() {
    state.bypass = true
    setTimeout(function () {
      const btn = state.pendingButton || findSendButton()
      if (btn) {
        btn.click()
      } else {
        const editor = findEditor()
        if (editor) {
          editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
        }
      }
      state.pendingButton = null
      setTimeout(function () {
        state.bypass = false
      }, 2500)
    }, 150)
  }

  // ---------- modal ----------
  let modalEl = null

  function ensureModal() {
    if (modalEl) return modalEl
    modalEl = document.createElement('div')
    modalEl.id = 'pl-modal-overlay'
    modalEl.setAttribute('role', 'dialog')
    modalEl.setAttribute('aria-modal', 'true')
    modalEl.innerHTML = [
      '<div class="pl-modal" role="document">',
      '  <div class="pl-modal-head">',
      '    <div class="pl-logo">' + shieldSvg() + '</div>',
      '    <div>',
      '      <div class="pl-modal-title">PII detected in your prompt</div>',
      '      <div class="pl-modal-sub"></div>',
      '    </div>',
      '  </div>',
      '  <div class="pl-modal-list"></div>',
      '  <div class="pl-modal-note">Nothing has been sent yet. Masking replaces each item with a placeholder before your prompt reaches the AI.</div>',
      '  <div class="pl-modal-actions">',
      '    <button type="button" class="pl-btn pl-btn-ghost" data-act="cancel">Edit prompt</button>',
      '    <button type="button" class="pl-btn pl-btn-warn" data-act="send">Send anyway</button>',
      '    <button type="button" class="pl-btn pl-btn-primary" data-act="mask">Mask &amp; send</button>',
      '  </div>',
      '</div>',
    ].join('')

    modalEl.addEventListener('click', function (e) {
      const act = e.target && e.target.closest && e.target.closest('[data-act]')
      if (!act) {
        if (e.target === modalEl) closeModal() // backdrop click = cancel
        return
      }
      handleAction(act.getAttribute('data-act'))
    })
    modalEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') handleAction('cancel')
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
        e.preventDefault()
        handleAction('mask')
      }
    })
    document.documentElement.appendChild(modalEl)
    return modalEl
  }

  function handleAction(act) {
    const ctx = modalEl && modalEl.__pl
    if (!ctx) return closeModal()
    if (act === 'mask') {
      const result = PII.maskText(ctx.text, ctx.items, settings.maskingStyle)
      setText(ctx.editor, result.masked)
      logEvent('masked', ctx.items, result.masked)
      hidePill()
      closeModal()
      retriggerSend()
    } else if (act === 'send') {
      logEvent('sent_anyway', ctx.items, ctx.text)
      hidePill()
      closeModal()
      retriggerSend()
    } else {
      logEvent('cancelled', ctx.items, ctx.text)
      closeModal()
      try {
        ctx.editor.focus()
      } catch (e) {}
    }
  }

  function openModal(editor, items, text) {
    const el = ensureModal()
    el.__pl = { editor: editor, items: items, text: text }
    el.querySelector('.pl-modal-sub').textContent =
      items.length + ' sensitive item' + (items.length > 1 ? 's' : '') + ' found on ' + SITE
    const list = el.querySelector('.pl-modal-list')
    list.innerHTML = items
      .map(function (it, idx) {
        const sev = it.severity
        return (
          '<div class="pl-item pl-sev-' + sev + '">' +
          '  <span class="pl-sev-dot"></span>' +
          '  <div class="pl-item-main">' +
          '    <div class="pl-item-type">' + PII.escapeHtml(it.label) + ' <span class="pl-item-sev">' + sev + '</span></div>' +
          '    <div class="pl-item-vals"><code class="pl-orig">' + PII.escapeHtml(trunc(it.value, 42)) + '</code>' +
          '    <span class="pl-arrow">&#8594;</span><code class="pl-repl">' + PII.escapeHtml(it.preview) + '</code></div>' +
          '  </div>' +
          '  <span class="pl-item-idx">#' + (idx + 1) + '</span>' +
          '</div>'
        )
      })
      .join('')
    el.classList.add('pl-visible')
    state.open = true
    const primary = el.querySelector('[data-act="mask"]')
    if (primary) primary.focus()
  }

  function closeModal() {
    if (modalEl) {
      modalEl.classList.remove('pl-visible')
      modalEl.__pl = null
    }
    state.open = false
  }

  function trunc(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }

  function shieldSvg() {
    return (
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><circle cx="12" cy="11" r="2.4"/><path d="M12 13.4V16"/></svg>'
    )
  }

  // ---------- live inline pill ----------
  let pillEl = null
  let pillTimer = null

  function ensurePill() {
    if (pillEl) return pillEl
    pillEl = document.createElement('div')
    pillEl.id = 'pl-pill'
    pillEl.setAttribute('aria-hidden', 'true')
    pillEl.innerHTML =
      '<span class="pl-pill-icon">' + shieldSvg() + '</span><span class="pl-pill-text"></span>'
    document.documentElement.appendChild(pillEl)
    return pillEl
  }

  function hidePill() {
    if (pillEl) pillEl.classList.remove('pl-visible')
  }

  function positionPill(editor) {
    if (!pillEl || !pillEl.classList.contains('pl-visible')) return
    try {
      const r = editor.getBoundingClientRect()
      pillEl.style.top = Math.max(8, r.bottom - 34) + 'px'
      pillEl.style.left = Math.max(8, r.right - pillEl.offsetWidth - 12) + 'px'
    } catch (e) {}
  }

  document.addEventListener(
    'input',
    function (e) {
      if (!settings.enabled) return hidePill()
      const editor = e.target && e.target.closest ? e.target.closest('[contenteditable="true"], textarea') : null
      if (!editor) return
      clearTimeout(pillTimer)
      pillTimer = setTimeout(function () {
        if (state.open) return
        const text = getText(editor)
        if (!text || text.trim().length < 4) return hidePill()
        const items = PII.scan(text)
        if (!items.length) return hidePill()
        const el = ensurePill()
        const worst = items.reduce(function (a, i) {
          return PII.SEVERITY_ORDER[i.severity] > PII.SEVERITY_ORDER[a] ? i.severity : a
        }, 'low')
        el.className = 'pl-visible pl-pill-sev-' + worst
        el.querySelector('.pl-pill-text').textContent =
          'PromptLens: ' + items.length + ' PII item' + (items.length > 1 ? 's' : '') + ' will be flagged'
        pillEl.classList.add('pl-visible')
        positionPill(editor)
      }, 500)
    },
    true
  )

  window.addEventListener('scroll', function () {
    if (pillEl) positionPill(findEditor())
  }, { passive: true })
  window.addEventListener('resize', function () {
    if (pillEl) positionPill(findEditor())
  }, { passive: true })
})()
