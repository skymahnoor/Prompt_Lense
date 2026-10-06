/**
 * PromptLens PII Engine
 * Detects and masks personally identifiable information in text.
 * Runs 100% locally — no network calls, no data leaves the browser.
 */
(function (global) {
  'use strict'

  const SEVERITY_ORDER = { critical: 3, high: 2, medium: 1, low: 0 }

  const TYPE_LABELS = {
    EMAIL: 'Email address',
    PHONE: 'Phone number',
    CREDIT_CARD: 'Card number',
    SSN: 'Social security no.',
    CNIC: 'National ID (CNIC)',
    AADHAAR: 'Aadhaar number',
    IBAN: 'IBAN',
    PASSPORT: 'Passport no.',
    API_KEY: 'API key / secret',
    IP_ADDRESS: 'IP address',
    NAME: 'Person name',
    ADDRESS: 'Physical address',
    DOB: 'Date of birth',
    ZIP: 'Postal / ZIP code',
  }

  const TYPE_SEVERITY = {
    CREDIT_CARD: 'critical',
    SSN: 'critical',
    API_KEY: 'critical',
    EMAIL: 'high',
    CNIC: 'high',
    AADHAAR: 'high',
    IBAN: 'high',
    PASSPORT: 'high',
    PHONE: 'medium',
    IP_ADDRESS: 'medium',
    ADDRESS: 'medium',
    DOB: 'medium',
    NAME: 'low',
    ZIP: 'low',
  }

  // Detectors are applied in priority order; earlier ones consume their spans
  // so later detectors don't double-match (e.g. digits inside a credit card).
  const DETECTORS = [
    {
      type: 'API_KEY',
      priority: 0,
      // OpenAI / GitHub / AWS / Slack / Google / GitLab / generic assignments + Bearer tokens
      pattern: new RegExp(
        [
          'sk-(?:proj-)?[A-Za-z0-9_-]{20,}',
          'sk-[A-Za-z0-9]{20,}',
          'gh[pousr]_[A-Za-z0-9]{20,}',
          'github_pat_[A-Za-z0-9_]{20,}',
          'AKIA[0-9A-Z]{16}',
          'xox[baprs]-[A-Za-z0-9-]{10,}',
          'AIza[0-9A-Za-z_-]{35}',
          'glpat-[A-Za-z0-9_-]{20,}',
          'npm_[A-Za-z0-9]{30,}',
          'Bearer\\s+[A-Za-z0-9._~+/=-]{24,}',
          '(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|access[_-]?key)\\s*[:=]\\s*["\']?[A-Za-z0-9._~+/=-]{8,}["\']?',
        ].join('|'),
        'gi'
      ),
    },
    {
      type: 'EMAIL',
      priority: 1,
      pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    },
    {
      type: 'CREDIT_CARD',
      priority: 2,
      pattern: /\b(?:\d[ -]?){12,18}\d\b/g,
      validate: function (m) {
        const digits = m.replace(/\D/g, '')
        if (digits.length < 13 || digits.length > 19) return false
        // Luhn check
        let sum = 0
        let dbl = false
        for (let i = digits.length - 1; i >= 0; i--) {
          let d = +digits[i]
          if (dbl) {
            d *= 2
            if (d > 9) d -= 9
          }
          sum += d
          dbl = !dbl
        }
        return sum % 10 === 0
      },
    },
    {
      type: 'SSN',
      priority: 3,
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    },
    {
      type: 'CNIC',
      priority: 4,
      pattern: /\b\d{5}-\d{7}-\d\b/g,
    },
    {
      type: 'IBAN',
      priority: 5,
      pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{2,6}){2,8}\b/g,
      validate: function (m) {
        const stripped = m.replace(/\s/g, '')
        return stripped.length >= 15 && stripped.length <= 34
      },
    },
    {
      type: 'AADHAAR',
      priority: 6,
      pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g,
    },
    {
      type: 'PASSPORT',
      priority: 7,
      pattern: /(?:passport(?:\s*(?:no|number|num))?)\s*[:\-]?\s*([A-Z]{0,2}\d{6,9})/gi,
      group: 1,
    },
    {
      type: 'DOB',
      priority: 8,
      // month word is validated fuzzily (see fuzzyMonth) so common typos and
      // short forms still match: "20 sptember 2007", "20 Sept 2007", "7 jan 05"
      pattern:
        /(?:dob|d\.o\.b\.?|date\s+of\s+birth|birth\s*date|born\s+(?:on|in)|birthday|paidaish)\s*(?:\bis\b|\bhai\b|\bmeri\b|\bmera\b)?\s*[:\-]?\s*((?:\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})|(?:\d{1,2}\s+[A-Za-z]{3,10}\s+\d{2,4}))/gi,
      group: 1,
      validate: function (v) {
        if (/^\d{1,4}[\/\-.]/.test(v.trim())) return true // numeric dd-mm-yyyy etc.
        const parts = v.trim().split(/\s+/)
        if (parts.length !== 3) return false
        return fuzzyMonth(parts[1])
      },
    },
    {
      type: 'IP_ADDRESS',
      priority: 9,
      pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    },
    {
      type: 'PHONE',
      priority: 10,
      // international/US/UK/general formats; validated by digit count below
      // trailing \d* keeps contiguous digit runs intact (e.g. "+92 300 1234567")
      pattern: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]\d{2,4}){0,4}\d*/g,
      validate: function (m, text, index) {
        const digits = m.replace(/\D/g, '')
        if (digits.length < 7 || digits.length > 15) return false
        // reject date-like values (yyyy-mm-dd, dd.mm.yyyy, dd/mm/yy)
        const v = m.trim()
        if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(v)) return false
        if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(v)) return false
        // reject when preceded by date-ish labels
        const before = text.slice(Math.max(0, index - 12), index).toLowerCase()
        if (/(dob|birth|date)/.test(before)) return false
        return true
      },
    },
    {
      type: 'NAME',
      priority: 11,
      // context triggers (case-flexible for "I am" / "I'm"); the captured name
      // must start with a capital letter, which filters "I am tired"-style sentences
      pattern: /(?:my name(?:'s| is)|[Ii]\s+am|[Ii]'m|name\s*[:\-]|this is)\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})/g,
      group: 1,
      minLen: 3,
      validate: function (v) {
        // common non-name words that legitimately follow "I am ..." —
        // keeps "I am tired/happy/busy" from being flagged as a person name
        const STOP = new Set([
          'the', 'and', 'but', 'for', 'not', 'very', 'really', 'just', 'so',
          'sad', 'happy', 'tired', 'busy', 'fine', 'good', 'great', 'okay',
          'sure', 'ready', 'done', 'here', 'there', 'back', 'new', 'old',
          'sorry', 'excited', 'bored', 'hungry', 'sick', 'confused', 'lost',
          'stuck', 'worried', 'curious', 'proud', 'grateful', 'available',
          'interested', 'confident', 'angry', 'glad', 'alive', 'awake',
        ])
        const first = v.split(' ')[0].toLowerCase()
        return !STOP.has(first)
      },
    },
    {
      type: 'ADDRESS',
      priority: 12,
      // English + Roman Urdu triggers. The capture is trimmed at sentence
      // connectors so both ADDRESS and a later DOB/other span in the same
      // sentence still get flagged independently.
      pattern:
        /(?:address|addr|residing\s+at|lives?\s+at|living\s+at|located\s+at|street\s+address|home\s+at|mera\s+ghar|hamara\s+ghar|mera\s+address|ghar\s+ka\s+pata|ghar\s*[:\-]|i\s+live\s+in|we\s+live\s+in)\s*(?:\bis\b|\bhai\b|\bmain\b|\bmein\b|\bat\b|:|\-)?\s*([^\n,;]{6,80})/gi,
      group: 1,
      trim: function (v) {
        // cut at Urdu/English connectors and filler so we flag the address part
        const cut = v.split(
          /\s+(?:aur|and|or|ya|per|par|mai|mein|me|hai|near|ke)\b|\.{2,}|\s+date\s+of\s+birth\b|\s+dob\b|\s+birthday\b/i
        )[0]
        return cut.replace(/[\s.\-]+$/, '').trim()
      },
    },
    {
      type: 'ZIP',
      priority: 13,
      pattern: /(?:zip|zip\s*code|postal\s*code|postcode|pin\s*code|pincode)\s*[:\-]?\s*(\d{4,10})/gi,
      group: 1,
    },
  ]

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  /**
   * Scan text for PII.
   * Returns [{type,label,severity,value,start,end,preview}]
   */
  const MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]

  /** Small edit-distance helper (classic Levenshtein, DP) */
  function levenshtein(a, b) {
    const m = a.length
    const n = b.length
    const dp = new Array(m + 1)
    for (let i = 0; i <= m; i++) {
      dp[i] = new Array(n + 1)
      dp[i][0] = i
    }
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        )
      }
    }
    return dp[m][n]
  }

  /** Fuzzy month-name check: prefixes ("sept") and typos ("sptember") pass */
  function fuzzyMonth(word) {
    const s = String(word || '').toLowerCase().replace(/[^a-z]/g, '')
    if (s.length < 3) return false
    for (const mo of MONTH_NAMES) {
      if (mo.startsWith(s)) return true
    }
    const tol = s.length >= 6 ? 2 : 1
    for (const mo of MONTH_NAMES) {
      if (levenshtein(s, mo) <= tol) return true
    }
    return false
  }

  function scan(text, opts) {
    opts = opts || {}
    if (!text || text.length < 4) return []
    const found = []
    const taken = [] // accepted [start,end) spans

    function overlaps(start, end) {
      for (const t of taken) {
        if (start < t[1] && end > t[0]) return true
      }
      return false
    }

    for (const det of DETECTORS) {
      if (opts.exclude && opts.exclude.includes(det.type)) continue
      det.pattern.lastIndex = 0
      let m
      while ((m = det.pattern.exec(text)) !== null) {
        let value = typeof det.group === 'number' && m[det.group] ? m[det.group] : m[0]
        let start = typeof det.group === 'number' && m[det.group] ? m.index + m[0].indexOf(value) : m.index
        let end = start + value.length
        if (det.trim) {
          value = det.trim(value)
          if (!value) continue
          end = start + value.length
        }
        if (value.length < (det.minLen || 4)) continue
        if (det.validate && !det.validate(value, text, start)) continue
        if (overlaps(start, end)) continue
        taken.push([start, end])
        found.push({
          type: det.type,
          label: TYPE_LABELS[det.type] || det.type,
          severity: TYPE_SEVERITY[det.type] || 'low',
          value: value,
          start: start,
          end: end,
          preview: maskValue(det.type, value),
        })
        if (det.pattern.lastIndex === m.index) det.pattern.lastIndex++ // zero-length safety
      }
    }

    found.sort(function (a, b) {
      return a.start - b.start || SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    })
    return found
  }

  /** Mask a single PII value (partial style for previews) */
  function maskValue(type, value) {
    const d = value.replace(/\s+/g, ' ')
    switch (type) {
      case 'EMAIL': {
        const at = d.indexOf('@')
        const local = d.slice(0, at)
        const domain = d.slice(at + 1)
        const dot = domain.lastIndexOf('.')
        return (
          local[0] +
          '•••' +
          '@' +
          (dot > 0 ? domain[0] + '•••' + domain.slice(dot) : '•••')
        )
      }
      case 'PHONE': {
        const digits = d.replace(/\D/g, '')
        return d.slice(0, Math.min(3, d.length)) + ' ••• •••' + digits.slice(-2)
      }
      case 'CREDIT_CARD': {
        const digits = d.replace(/\D/g, '')
        return '•••• •••• •••• ' + digits.slice(-4)
      }
      case 'SSN':
        return '•••-••-' + d.replace(/\D/g, '').slice(-4)
      case 'CNIC':
        return d.slice(0, 5) + '-•••••••-' + d.slice(-1)
      case 'AADHAAR':
        return '•••• •••• ' + d.replace(/\D/g, '').slice(-4)
      case 'IBAN':
        return d.slice(0, 4) + ' •••• ' + d.slice(-4)
      case 'API_KEY': {
        const head = d.match(/^(sk-(?:proj-)?|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|AKIA|xox[baprs]-|AIza|glpat-|npm_|Bearer\s+)/i)
        return (head ? head[1] : '') + '••••••••' + d.slice(-4)
      }
      case 'IP_ADDRESS': {
        const parts = d.split('.')
        return parts[0] + '.' + parts[1] + '.•••.' + parts[3]
      }
      case 'NAME': {
        const parts = d.split(' ')
        return parts
          .map(function (p) {
            return p[0] + '•••'
          })
          .join(' ')
      }
      case 'ADDRESS':
        return d.slice(0, Math.min(8, d.length)) + '•••'
      case 'DOB':
      case 'PASSPORT':
      case 'ZIP':
      default:
        return '••••'
    }
  }

  /**
   * Mask all detected items in text.
   * style: 'placeholder' → [EMAIL_1]; 'partial' → j•••@g•••.com; 'redact' → ████
   * Returns { masked, mapping }
   */
  function maskText(text, items, style) {
    style = style || 'placeholder'
    const counters = {}
    const mapping = []
    let masked = text

    // replace from end → start so indices stay valid
    const sorted = items.slice().sort(function (a, b) {
      return b.start - a.start
    })
    for (const item of sorted) {
      counters[item.type] = (counters[item.type] || 0) + 1
      let replacement
      if (style === 'partial') {
        replacement = maskValue(item.type, item.value)
      } else if (style === 'redact') {
        replacement = '█'.repeat(Math.min(item.value.length, 10))
      } else {
        replacement =
          '[' + item.type + '_' + counters[item.type] + ']'
      }
      mapping.push({
        type: item.type,
        label: item.label,
        severity: item.severity,
        original: item.value,
        replacement: replacement,
      })
      masked = masked.slice(0, item.start) + replacement + masked.slice(item.end)
    }
    mapping.reverse()
    return { masked: masked, mapping: mapping }
  }

  const API = {
    scan: scan,
    maskText: maskText,
    maskValue: maskValue,
    TYPE_LABELS: TYPE_LABELS,
    TYPE_SEVERITY: TYPE_SEVERITY,
    escapeHtml: escapeHtml,
    SEVERITY_ORDER: SEVERITY_ORDER,
  }

  global.PromptLensPII = API
  if (typeof module !== 'undefined' && module.exports) module.exports = API
})(typeof window !== 'undefined' ? window : globalThis)
