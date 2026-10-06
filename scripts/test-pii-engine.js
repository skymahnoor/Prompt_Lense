// Quick test of the PII engine (node)
const P = require('/home/z/my-project/extension/lib/pii-engine.js')

// build key-like strings at runtime (avoid editors/tools redacting them)
const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
const GH_TOKEN = 'ghp_' + 'AbCdEfGhIjKlMnOpQrStUvWx'
const OAI_KEY = 'sk-proj-' + '9x2KpLmNqR4tUv8WxYz12'

const samples = [
  'Hi, my name is Sarah Ahmed, email sarah.ahmed@gmail.com or call +92 300 1234567.',
  'Card 4111 1111 1111 1111 declined, key ' + OAI_KEY + '.',
  'AWS key ' + AWS_KEY + ' failed for IP 192.168.4.77 on 2024-01-15.',
  'CNIC 42101-1234567-8, DOB: 1994-03-21, zip: 44000',
  'No PII here, just a normal question about the history of Rome in 50 BC.',
  'My SSN is 512-44-7289 and token ' + GH_TOKEN,
  'IBAN GB29 NWBK 6016 1331 9268 19, password: hunter2secret',
  'address: 742 Evergreen Terrace, Springfield phone: (415) 555-4521',
]

for (const s of samples) {
  const items = P.scan(s)
  const { masked } = P.maskText(s, items, 'placeholder')
  console.log('---')
  console.log('IN :', s)
  console.log('FOUND:', items.map((i) => i.type + '("' + i.value + '")').join(', ') || 'none')
  console.log('OUT:', masked)
}

// unit checks
const assert = require('assert')
assert(P.scan('test@example.com').some((i) => i.type === 'EMAIL'), 'email detect')
assert(P.scan('4111 1111 1111 1111').some((i) => i.type === 'CREDIT_CARD'), 'card luhn pass')
assert(P.scan('5555 5555 5555 4444').some((i) => i.type === 'CREDIT_CARD'), 'card luhn pass mc')
assert(!P.scan('4532 0151 1283 4241').some((i) => i.type === 'CREDIT_CARD'), 'card luhn fail')
assert(!P.scan('In 2024-01-15 something happened').some((i) => i.type === 'PHONE'), 'date not phone')
assert(P.scan('+92 300 1234567').some((i) => i.type === 'PHONE'), 'phone detect')
assert(P.scan('key ' + AWS_KEY).some((i) => i.type === 'API_KEY'), 'aws key detect')
assert(P.scan('token ' + GH_TOKEN).some((i) => i.type === 'API_KEY'), 'github token detect')
assert(P.scan('42101-1234567-8').some((i) => i.type === 'CNIC'), 'cnic detect')
console.log('ALL ENGINE TESTS PASSED')
