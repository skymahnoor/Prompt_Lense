/** PromptLens popup — quick stats, toggle, dashboard link (100% local) */
document.addEventListener('DOMContentLoaded', function () {
  const $ = function (id) {
    return document.getElementById(id)
  }

  // toggle
  const toggle = $('enabled')
  chrome.storage.sync.get({ enabled: true }, function (s) {
    toggle.checked = s.enabled !== false
  })
  toggle.addEventListener('change', function () {
    chrome.storage.sync.set({ enabled: toggle.checked })
  })

  // stats — read from local storage only
  chrome.storage.local.get({ events: [] }, function (d) {
    const events = d.events || []
    const today = new Date().toDateString()
    let flagged = 0
    let masked = 0
    let leaked = 0
    const typeCounts = {}
    const sevOf = {}
    for (const e of events) {
      if (new Date(e.createdAt).toDateString() === today) flagged += e.totalPii || 0
      if (e.action === 'masked') masked += e.totalPii || 0
      if (e.action === 'sent_anyway') leaked += e.totalPii || 0
      for (const it of e.items || []) {
        typeCounts[it.type] = (typeCounts[it.type] || 0) + it.count
        sevOf[it.type] = it.severity
      }
    }
    $('st-today').textContent = String(flagged)
    $('st-masked').textContent = String(masked)
    $('st-leaked').textContent = String(leaked)

    const typesEl = $('types')
    const entries = Object.entries(typeCounts).sort(function (a, b) {
      return b[1] - a[1]
    }).slice(0, 6)
    if (entries.length === 0) {
      typesEl.innerHTML = '<span class="type-empty">No PII detected yet — browse an AI chat site to get started.</span>'
    } else {
      typesEl.innerHTML = entries
        .map(function (pair) {
          return (
            '<span class="type-chip t-' + (sevOf[pair[0]] || 'low') + '">' +
            pair[0].replace(/_/g, ' ').toLowerCase() + ' ×' + pair[1] + '</span>'
          )
        })
        .join('')
    }
  })

  // open the built-in local dashboard (chrome-extension://…/dashboard.html)
  $('btn-local').addEventListener('click', function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
    window.close()
  })
})
