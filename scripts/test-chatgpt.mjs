const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  console.error('Falta OPENAI_API_KEY en el entorno')
  process.exit(1)
}

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Dime un dato curioso en una frase.' }],
  }),
})

if (!res.ok) {
  console.error('Error', res.status, await res.text())
  process.exit(1)
}

const data = await res.json()
console.log(data.choices[0].message.content)
