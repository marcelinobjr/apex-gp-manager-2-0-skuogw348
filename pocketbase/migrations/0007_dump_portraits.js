migrate(
  (app) => {
    // Busca os 188 pilotos cadastrados na collection drivers e emite JSON
    const drivers = app.findRecordsByFilter('drivers', '', 'driver_id', 200, 0)
    const map = {}
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i]
      const notes = d.get('notes') || ''
      const match = notes.match(/DRV_\d{4}/)
      map[d.get('driver_id')] = match ? match[0] : ''
    }
    console.log('DRIVER_PORTRAIT_MAP_DUMP_START')
    console.log(JSON.stringify(map))
    console.log('DRIVER_PORTRAIT_MAP_DUMP_END')
  },
  (app) => {},
)
