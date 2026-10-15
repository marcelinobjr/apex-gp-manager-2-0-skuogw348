migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'm.blasques@multi.br.com')
    } catch (_) {
      const user = new Record(users)
      user.setEmail('m.blasques@multi.br.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Marcelino Blasques')
      app.save(user)
    }
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'm.blasques@multi.br.com')
      app.delete(user)
    } catch (_) {}
  },
)
