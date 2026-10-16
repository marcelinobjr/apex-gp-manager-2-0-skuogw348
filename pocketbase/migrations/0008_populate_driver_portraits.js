migrate(
  (app) => {
    // 1. Atualizar portrait_asset_id na collection drivers se estiver vazio
    // derivando a foto comprovada a partir da coluna notes ('Foto conferida: pilotos/DRV_XXXX.jpg')
    const drivers = app.findRecordsByFilter('drivers', '', 'driver_id', 300, 0)
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i]
      const notes = d.getString('notes') || ''
      const match = notes.match(/DRV_\d{4}/)
      if (match) {
        const portraitCode = match[0]
        if (!d.getString('portrait_asset_id')) {
          d.set('portrait_asset_id', portraitCode)
          app.save(d)
        }
      }
    }
  },
  (app) => {},
)
