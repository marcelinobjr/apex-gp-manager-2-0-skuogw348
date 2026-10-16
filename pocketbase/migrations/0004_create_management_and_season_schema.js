migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = users.id
    const careers = app.findCollectionByNameOrId('careers')
    const careersId = careers.id

    // 1. seasons: Registro imutável de cada temporada da carreira (INV-02)
    const seasons = new Collection({
      name: 'seasons',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'career_id',
          type: 'relation',
          required: true,
          collectionId: careersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'year', type: 'number', required: true, min: 1950, max: 2050, onlyInt: true },
        { name: 'status', type: 'text', required: true, min: 2, max: 30 }, // 'IN_PROGRESS', 'COMPLETED'
        { name: 'current_round', type: 'number', required: true, min: 0, max: 50, onlyInt: true },
        { name: 'total_rounds', type: 'number', required: true, min: 1, max: 50, onlyInt: true },
        { name: 'drivers_standings', type: 'json' }, // Pontuação derivada canônica (INV-01)
        { name: 'constructors_standings', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_seasons_career ON seasons (career_id)',
        'CREATE UNIQUE INDEX idx_seasons_career_year ON seasons (career_id, year)',
      ],
    })
    app.save(seasons)

    const seasonsCollection = app.findCollectionByNameOrId('seasons')
    const seasonsId = seasonsCollection.id

    // 2. season_events: Calendário da temporada com circuitos e resultados oficiais (INV-01, INV-03)
    const seasonEvents = new Collection({
      name: 'season_events',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'career_id',
          type: 'relation',
          required: true,
          collectionId: careersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'season_id',
          type: 'relation',
          required: true,
          collectionId: seasonsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'round', type: 'number', required: true, min: 1, max: 50, onlyInt: true },
        { name: 'circuit_id', type: 'text', required: true, min: 2, max: 40 }, // CIR-0001 .. CIR-0043
        { name: 'track_name', type: 'text', required: true, min: 2, max: 120 },
        { name: 'country_code', type: 'text', required: true, min: 2, max: 10 },
        { name: 'status', type: 'text', required: true, min: 2, max: 30 }, // 'SCHEDULED', 'COMPLETED'
        { name: 'results', type: 'json' }, // Posições finais, tempos, voltas rápidas
        { name: 'weather', type: 'json' }, // Clima sorteado
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_season_events_season ON season_events (season_id)',
        'CREATE UNIQUE INDEX idx_season_events_round ON season_events (season_id, round)',
      ],
    })
    app.save(seasonEvents)

    // 3. car_components: Estado físico das peças mecânicas do carro (módulo 4.3)
    // 4 motores físicos por piloto, asas, assoalho, laterais, suspensão com desgaste (INV-03)
    const carComponents = new Collection({
      name: 'car_components',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'career_id',
          type: 'relation',
          required: true,
          collectionId: careersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'team_id', type: 'text', required: true, min: 2, max: 40 },
        { name: 'car_index', type: 'number', required: true, min: 1, max: 2, onlyInt: true }, // Carro 1 ou 2
        { name: 'component_type', type: 'text', required: true, min: 2, max: 40 }, // front_wing, rear_wing, floor, sidepods, suspension, engine
        { name: 'component_name', type: 'text', required: true, min: 2, max: 80 },
        { name: 'level', type: 'number', required: true, min: 1, max: 10, onlyInt: true },
        { name: 'condition_pct', type: 'number', required: true, min: 0, max: 100 }, // Desgaste 0 a 100%
        { name: 'engine_unit_number', type: 'number', min: 1, max: 8, onlyInt: true }, // 1..4 (motores físicos alocados)
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_car_comp_career ON car_components (career_id)',
        'CREATE INDEX idx_car_comp_team ON car_components (career_id, team_id)',
      ],
    })
    app.save(carComponents)

    // 4. rd_projects: Projetos de Pesquisa & Desenvolvimento com sorte técnica (70/25/5% bom/normal/ruim)
    const rdProjects = new Collection({
      name: 'rd_projects',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'career_id',
          type: 'relation',
          required: true,
          collectionId: careersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, min: 2, max: 120 },
        { name: 'category', type: 'text', required: true, min: 2, max: 40 }, // aero, chassis, powertrain, reliability
        { name: 'cost', type: 'number', required: true, min: 0 }, // Custo debitado do caixa e teto
        { name: 'duration_rounds', type: 'number', required: true, min: 1, max: 20, onlyInt: true },
        {
          name: 'rounds_remaining',
          type: 'number',
          required: true,
          min: 0,
          max: 20,
          onlyInt: true,
        },
        { name: 'status', type: 'text', required: true, min: 2, max: 30 }, // 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
        { name: 'outcome_quality', type: 'text' }, // 'EXCELLENT' (+15%), 'NORMAL' (+8%), 'POOR' (+2%)
        { name: 'attribute_boost', type: 'json' }, // Atributos incrementados
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rd_proj_career ON rd_projects (career_id)',
        'CREATE INDEX idx_rd_proj_status ON rd_projects (career_id, status)',
      ],
    })
    app.save(rdProjects)
  },
  (app) => {
    try {
      const rd = app.findCollectionByNameOrId('rd_projects')
      app.delete(rd)
    } catch (_) {}

    try {
      const cc = app.findCollectionByNameOrId('car_components')
      app.delete(cc)
    } catch (_) {}

    try {
      const se = app.findCollectionByNameOrId('season_events')
      app.delete(se)
    } catch (_) {}

    try {
      const s = app.findCollectionByNameOrId('seasons')
      app.delete(s)
    } catch (_) {}
  },
)
