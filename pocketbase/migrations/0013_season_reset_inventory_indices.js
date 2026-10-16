// pocketbase/migrations/0013_season_reset_inventory_indices.js
// APEX GP Manager 2.0 - Lote SEASON-RESET-01
// Adiciona índices otimizados para consulta histórica e particionamento temporal de inventário

migrate(
  (app) => {
    const carComponents = app.findCollectionByNameOrId('car_components')

    // Índice composto para busca rápida de inventário ativo por carreira e temporada
    carComponents.addIndex(
      'idx_car_comp_career_year_status',
      false,
      'career_id, season_year, status',
      '',
    )

    // Índice composto para busca e contagem de unidades de potência por carro e temporada
    carComponents.addIndex(
      'idx_car_comp_pu_season',
      false,
      'career_id, season_year, car_index, component_type, engine_unit_number',
      '',
    )

    app.save(carComponents)
  },
  (app) => {
    try {
      const carComponents = app.findCollectionByNameOrId('car_components')
      carComponents.removeIndex('idx_car_comp_career_year_status')
      carComponents.removeIndex('idx_car_comp_pu_season')
      app.save(carComponents)
    } catch (_) {}
  },
)
