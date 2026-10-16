// pocketbase/migrations/0015_driver_contracts_and_market.js
// APEX GP Manager 2.0 - QA-GESTAO-05C4 (v0.0.20)
// Contratos de Pilotos, Mercado de Transferências, Negociações Persistentes e Histórico de Carreira.
//
// Princípios Fundamentais (Doc Mestre Consolidado v2.2, seções 4.2 e 13):
// - driver_id e team_id canônicos e imutáveis; contratos pertencem à carreira, nunca alteram o Catálogo Mestre.
// - Piloto não pode possuir dois contratos titulares incompatíveis no mesmo período/temporada.
// - Contratos históricos nunca são apagados para representar troca de equipe; novo contrato cria novo registro.
// - Suporte a contratos futuros (ex: piloto corre na Equipe A em 2026, assina com B para 2027).
// - Separação estrita: Catálogo (identidade e atributos base) vs Carreira (vínculo, salário, status, histórico).

migrate(
  (app) => {
    const careers = app.findCollectionByNameOrId('careers')
    const careersId = careers.id
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = users.id

    // =========================================================================
    // 1. driver_contracts: Contratos de pilotos por carreira
    // Estados: DRAFT, PROPOSED, NEGOTIATING, ACCEPTED, ACTIVE, FUTURE, EXPIRED, TERMINATED, REJECTED, CANCELLED
    // =========================================================================
    let contractsCol
    try {
      contractsCol = app.findCollectionByNameOrId('driver_contracts')
    } catch (_) {
      contractsCol = null
    }

    if (!contractsCol) {
      contractsCol = new Collection({
        name: 'driver_contracts',
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
          { name: 'driver_id', type: 'text', required: true, maxSize: 40 },
          { name: 'team_id', type: 'text', required: true, maxSize: 40 },
          {
            name: 'role',
            type: 'select',
            required: true,
            values: ['PRIMARY_1', 'PRIMARY_2', 'RESERVE', 'ACADEMY'],
            maxSelect: 1,
          },
          { name: 'start_season', type: 'number', required: true, onlyInt: true },
          { name: 'end_season', type: 'number', required: true, onlyInt: true },
          { name: 'salary_annual', type: 'number', required: true, onlyInt: false },
          { name: 'signing_bonus', type: 'number', onlyInt: false },
          { name: 'buyout_clause', type: 'number', onlyInt: false },
          {
            name: 'contract_status',
            type: 'select',
            required: true,
            values: [
              'PROPOSED',
              'NEGOTIATING',
              'ACCEPTED',
              'ACTIVE',
              'FUTURE',
              'EXPIRED',
              'TERMINATED',
              'REJECTED',
              'CANCELLED',
            ],
            maxSelect: 1,
          },
          { name: 'source', type: 'text', maxSize: 40 }, // 'INITIAL_SETUP', 'PLAYER_SIGNING', 'AI_TRANSFER', 'RENEWAL'
          { name: 'signed_at', type: 'text', maxSize: 40 },
          { name: 'terminated_at', type: 'text', maxSize: 40 },
          { name: 'termination_reason', type: 'text', maxSize: 300 },
          { name: 'performance_clauses', type: 'json', maxSize: 200_000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_drv_contracts_career ON driver_contracts (career_id)',
          'CREATE INDEX idx_drv_contracts_driver ON driver_contracts (career_id, driver_id)',
          'CREATE INDEX idx_drv_contracts_team ON driver_contracts (career_id, team_id)',
          'CREATE INDEX idx_drv_contracts_status ON driver_contracts (career_id, contract_status)',
        ],
      })
      app.save(contractsCol)
    }

    // =========================================================================
    // 2. driver_negotiations: Sessões de negociação persistente
    // Estados: IN_PROGRESS, ACCEPTED, REJECTED, COUNTER_OFFER, EXPIRED, CANCELLED
    // =========================================================================
    let negCol
    try {
      negCol = app.findCollectionByNameOrId('driver_negotiations')
    } catch (_) {
      negCol = null
    }

    if (!negCol) {
      negCol = new Collection({
        name: 'driver_negotiations',
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
          { name: 'driver_id', type: 'text', required: true, maxSize: 40 },
          { name: 'team_id', type: 'text', required: true, maxSize: 40 },
          { name: 'season_year', type: 'number', required: true, onlyInt: true },
          { name: 'target_role', type: 'text', required: true, maxSize: 30 },
          { name: 'target_start_season', type: 'number', required: true, onlyInt: true },
          { name: 'target_duration_years', type: 'number', required: true, onlyInt: true },
          { name: 'offered_salary', type: 'number', required: true, onlyInt: false },
          { name: 'offered_bonus', type: 'number', onlyInt: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: [
              'IN_PROGRESS',
              'ACCEPTED',
              'REJECTED',
              'COUNTER_OFFER',
              'EXPIRED',
              'CANCELLED',
            ],
            maxSelect: 1,
          },
          { name: 'round_number', type: 'number', required: true, onlyInt: true }, // rodada da proposta (1, 2, 3...)
          { name: 'driver_response_message', type: 'text', maxSize: 500 },
          { name: 'counter_salary', type: 'number', onlyInt: false },
          { name: 'counter_bonus', type: 'number', onlyInt: false },
          { name: 'reserve_receipt_key', type: 'text', maxSize: 120 },
          { name: 'is_ai_team', type: 'bool' },
          { name: 'history', type: 'json', maxSize: 500_000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_drv_neg_career ON driver_negotiations (career_id)',
          'CREATE INDEX idx_drv_neg_pair ON driver_negotiations (career_id, driver_id, team_id)',
          'CREATE INDEX idx_drv_neg_status ON driver_negotiations (career_id, status)',
        ],
      })
      app.save(negCol)
    }

    // =========================================================================
    // 3. driver_career_records: Estado esportivo/psicológico do piloto na carreira
    // Moral, lealdade, demanda salarial estimada, equipe atual, histórico na carreira
    // =========================================================================
    let drvStateCol
    try {
      drvStateCol = app.findCollectionByNameOrId('driver_career_records')
    } catch (_) {
      drvStateCol = null
    }

    if (!drvStateCol) {
      drvStateCol = new Collection({
        name: 'driver_career_records',
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
          { name: 'driver_id', type: 'text', required: true, maxSize: 40 },
          { name: 'current_team_id', type: 'text', maxSize: 40 },
          { name: 'current_role', type: 'text', maxSize: 30 },
          { name: 'active_contract_id', type: 'text', maxSize: 40 },
          { name: 'future_contract_id', type: 'text', maxSize: 40 },
          { name: 'morale', type: 'number', required: true, min: 0, max: 100, onlyInt: true },
          { name: 'reputation', type: 'number', min: 0, max: 100, onlyInt: true },
          { name: 'market_status', type: 'text', required: true, maxSize: 30 }, // 'CONTRACTED', 'EXPIRING', 'FREE_AGENT', 'FUTURE_COMMITTED'
          { name: 'career_history', type: 'json', maxSize: 500_000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_dcr_driver_career ON driver_career_records (career_id, driver_id)',
          'CREATE INDEX idx_dcr_career ON driver_career_records (career_id)',
          'CREATE INDEX idx_dcr_status ON driver_career_records (career_id, market_status)',
        ],
      })
      app.save(drvStateCol)
    }
  },
  (app) => {
    const dropSafe = (name) => {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
    dropSafe('driver_career_records')
    dropSafe('driver_negotiations')
    dropSafe('driver_contracts')
  },
)
