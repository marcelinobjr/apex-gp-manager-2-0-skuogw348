// pocketbase/migrations/0014_rd_pipeline_facilities_technical_state.js
// APEX GP Manager 2.0 - QA-GESTAO-05C3 (v0.0.18)
// Estrutura para o ciclo completo de P&D (8 estados), efeitos causais das 9 instalações,
// notas técnicas efetivas da temporada e componentes fabricados a partir de projetos.
//
// Regras (Doc Mestre Consolidado v2.2, seções 13.5 e 13.9):
// - rd_projects ganha o ciclo canônico: PROPOSED -> RESERVED -> RESEARCHING -> DESIGNED ->
//   MANUFACTURING -> READY -> INSTALLED -> FAILED/CANCELLED (com histórico completo).
// - O sorte técnico acontece UMA única vez, no momento em que a pesquisa conclui, com seed
//   determinística por projeto (resultSeed); recarregar o jogo nunca muda o resultado.
// - facility_projects registram cada upgrade de instalação (nível 1..5, prazo, efeito,
//   histórico) — nada de bônus decorativo.
// - team_technical_state guarda as notas efetivas da temporada por carreira/equipe, sem
//   sobrescrever o catálogo mestre de src/data/game.ts.

migrate(
  (app) => {
    const ensureField = (col, field) => {
      if (!col.fields.getByName(field.name)) {
        col.fields.add(field)
      }
    }

    // ================= rd_projects: ciclo de estados canônico =================
    const rd = app.findCollectionByNameOrId('rd_projects')

    const rdJson = (name) => new JSONField({ name: name, maxSize: 2_000_000 })

    ensureField(rd, new TextField({ name: 'target_attributes', maxSize: 2000 }))
    ensureField(rd, new TextField({ name: 'risk_strategy', maxSize: 30 }))
    ensureField(rd, new TextField({ name: 'design_center_level', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'cfd_cluster_level', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'wind_tunnel_level', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'factory_level', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'operations_center_level', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'industrial_structure_level', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'project_seed', maxSize: 80 }))
    ensureField(rd, new TextField({ name: 'result_seed', maxSize: 80 }))
    ensureField(rd, new TextField({ name: 'result_rolled_at', maxSize: 40 }))
    ensureField(rd, new TextField({ name: 'component_type', maxSize: 30 }))
    ensureField(rd, new TextField({ name: 'component_name', maxSize: 120 }))
    ensureField(rd, new TextField({ name: 'component_serial', maxSize: 80 }))
    ensureField(rd, new TextField({ name: 'manufactured_component_id', maxSize: 30 }))
    ensureField(rd, new TextField({ name: 'installed_component_id', maxSize: 30 }))
    ensureField(rd, new TextField({ name: 'installed_car_index', maxSize: 10 }))
    ensureField(rd, new TextField({ name: 'cancelled_reason', maxSize: 300 }))
    ensureField(rd, new NumberField({ name: 'spent_cash', onlyInt: false }))
    ensureField(rd, new NumberField({ name: 'spend_cap_used', onlyInt: false }))
    ensureField(rd, new NumberField({ name: 'released_cash', onlyInt: false }))
    ensureField(rd, new NumberField({ name: 'released_cap', onlyInt: false }))
    ensureField(rd, new NumberField({ name: 'progress_pct', onlyInt: false }))
    ensureField(rd, rdJson('facility_allocations'))
    ensureField(rd, rdJson('result_detail'))
    ensureField(rd, rdJson('state_history'))

    // Status canônico de 8 estados (texto: migração preserva IN_PROGRESS/COMPLETED legados)
    ensureField(
      rd,
      new SelectField({
        name: 'status_canonical',
        values: [
          'PROPOSED',
          'RESERVED',
          'RESEARCHING',
          'DESIGNED',
          'MANUFACTURING',
          'READY',
          'INSTALLED',
          'FAILED',
          'CANCELLED',
        ],
        maxSelect: 1,
      }),
    )

    app.save(rd)

    // ================= facility_projects: upgrades de instalação =================
    let facilityProjects
    try {
      facilityProjects = app.findCollectionByNameOrId('facility_projects')
    } catch (_) {
      facilityProjects = null
    }
    if (!facilityProjects) {
      const careersId = app.findCollectionByNameOrId('careers').id
      facilityProjects = new Collection({
        name: 'facility_projects',
        type: 'base',
        listRule: '@request.auth.id != "" && user_id = @request.auth.id',
        viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
        deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
        fields: [
          {
            name: 'career_id',
            type: 'relation',
            required: true,
            collectionId: careersId,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'facility_code', type: 'text', required: true, maxSize: 40 },
          { name: 'facility_name', type: 'text', required: true, maxSize: 120 },
          { name: 'from_level', type: 'number', required: true, onlyInt: true },
          { name: 'to_level', type: 'number', required: true, onlyInt: true },
          { name: 'cost_cash', type: 'number', required: true, onlyInt: false },
          { name: 'cost_cap', type: 'number', required: true, onlyInt: false },
          { name: 'rounds_remaining', type: 'number', required: true, onlyInt: true },
          { name: 'duration_rounds', type: 'number', required: true, onlyInt: true },
          {
            name: 'status',
            type: 'text',
            required: true,
            values: ['CONSTRUCTION', 'COMPLETED', 'CANCELLED'],
            maxSelect: 1,
          },
          { name: 'effect_target_service', type: 'text', maxSize: 80 },
          { name: 'effect_summary', type: 'text', maxSize: 500 },
          { name: 'pending_integration', type: 'bool' },
          { name: 'reserve_key', type: 'text', maxSize: 120 },
          { name: 'history', type: 'json', maxSize: 500_000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_fac_proj_career ON facility_projects (career_id)',
          'CREATE INDEX idx_fac_proj_facility ON facility_projects (career_id, facility_code)',
        ],
      })
      app.save(facilityProjects)
    }

    // ================= team_technical_state: notas efetivas por temporada =================
    let techState
    try {
      techState = app.findCollectionByNameOrId('team_technical_state')
    } catch (_) {
      techState = null
    }
    if (!techState) {
      const careersId = app.findCollectionByNameOrId('careers').id
      techState = new Collection({
        name: 'team_technical_state',
        type: 'base',
        listRule: '@request.auth.id != "" && user_id = @request.auth.id',
        viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != "" && user_id = @request.auth.id',
        deleteRule: '@request.auth.id != "" && user_id = @request.auth.id',
        fields: [
          {
            name: 'career_id',
            type: 'relation',
            required: true,
            collectionId: careersId,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'team_id', type: 'text', required: true, maxSize: 30 },
          { name: 'season_year', type: 'number', required: true, onlyInt: true },
          { name: 'effective_attributes', type: 'json', maxSize: 200_000 },
          { name: 'baseline_attributes', type: 'json', maxSize: 200_000 },
          { name: 'source_ledger', type: 'json', maxSize: 1_000_000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_tts_unique ON team_technical_state (career_id, team_id, season_year)',
          'CREATE INDEX idx_tts_career ON team_technical_state (career_id)',
        ],
      })
      app.save(techState)
    }
  },
  (app) => {
    const dropSafe = (name) => {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
    dropSafe('team_technical_state')
    dropSafe('facility_projects')
  },
)
