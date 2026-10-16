// pocketbase/migrations/0010_financial_integrity_fields.js
migrate(
  (app) => {
    const careerState = app.findCollectionByNameOrId('career_state')

    // Verificar se reserved_cash e reserved_cost_cap já existem
    const existingReservedCash = careerState.fields.getByName('reserved_cash')
    if (!existingReservedCash) {
      careerState.fields.add(
        new NumberField({
          name: 'reserved_cash',
          required: false,
          min: 0,
        }),
      )
    }

    const existingReservedCap = careerState.fields.getByName('reserved_cost_cap')
    if (!existingReservedCap) {
      careerState.fields.add(
        new NumberField({
          name: 'reserved_cost_cap',
          required: false,
          min: 0,
        }),
      )
    }

    app.save(careerState)
  },
  (app) => {
    try {
      const careerState = app.findCollectionByNameOrId('career_state')
      careerState.fields.removeByName('reserved_cash')
      careerState.fields.removeByName('reserved_cost_cap')
      app.save(careerState)
    } catch (_) {}
  },
)
