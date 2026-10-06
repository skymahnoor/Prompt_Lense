/**
 * PromptLens background service worker
 * 100% LOCAL: updates the toolbar badge (PII flagged today).
 * No network access. No syncing. No telemetry. Ever.
 * All interception events are stored only in chrome.storage.local on this device.
 */
const MAX_EVENTS = 1000

// ---------- init ----------
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get({ events: [] }, function (d) {
    if (!Array.isArray(d.events)) chrome.storage.local.set({ events: [] })
  })
  refreshBadge()
})

chrome.runtime.onStartup.addListener(function () {
  refreshBadge()
})

// ---------- messages from content script ----------
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === 'pl-event' && msg.event) {
    handleEvent(msg.event)
    sendResponse({ ok: true })
  } else if (msg && msg.type === 'pl-get-badge') {
    sendResponse({ count: todayCount })
  }
  return false
})

let todayCount = 0

function handleEvent(event) {
  // badge = PII items flagged today
  const day = new Date(event.createdAt || Date.now()).toDateString()
  const today = new Date().toDateString()
  if (day === today) {
    todayCount += event.totalPii || 0
    updateBadge(todayCount)
  }
}

function updateBadge(count) {
  const text = count > 0 ? (count > 99 ? '99+' : String(count)) : ''
  chrome.action.setBadgeText({ text: text })
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
  chrome.action.setTitle({ title: 'PromptLens — ' + count + ' PII items flagged today (stored locally)' })
}

function refreshBadge() {
  chrome.storage.local.get({ events: [] }, function (d) {
    const today = new Date().toDateString()
    todayCount = (d.events || []).filter(function (e) {
      return new Date(e.createdAt).toDateString() === today
    }).reduce(function (a, e) {
      return a + (e.totalPii || 0)
    }, 0)
    updateBadge(todayCount)
  })
}
