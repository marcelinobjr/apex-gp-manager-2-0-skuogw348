migrate(
  (app) => {
    const email = 'm.blasques@multi.br.com'
    try {
      app.findAuthRecordByEmail('users', email)
      return
    } catch (_) {
      const collection = app.findCollectionByNameOrId('users')
      const record = new Record(collection)
      record.set('email', email)
      record.set('password', 'Skip@Pass')
      record.set('name', 'Manager APEX')
      record.set('verified', true)
      app.save(record)
    }
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('users', 'm.blasques@multi.br.com')
      app.delete(record)
    } catch (_) {}
  },
)
