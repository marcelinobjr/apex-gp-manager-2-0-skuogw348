migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = users.id

    // 1. Collection 'careers': Definição canônica congelada da Carreira
    // INV-01: resultado oficial único | INV-02: temporadas imutáveis
    // Armazena configuração congelada: universo/ano inicial, equipes participantes, forças (50-150%), regulamento, seed mestre
    const careers = new Collection({
      name: 'careers',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true, min: 2, max: 120 },
        {
          name: 'initial_year',
          type: 'number',
          required: true,
          min: 1950,
          max: 2050,
          onlyInt: true,
        },
        {
          name: 'current_year',
          type: 'number',
          required: true,
          min: 1950,
          max: 2050,
          onlyInt: true,
        },
        { name: 'universe_type', type: 'text', required: true, min: 2, max: 50 }, // 'f1_oficial', 'ficticio_personalizado', etc.
        { name: 'manager_archetype_id', type: 'text', required: true, min: 3, max: 30 }, // mgr_0001 .. mgr_0006
        { name: 'managed_team_id', type: 'text', required: true, min: 3, max: 30 }, // team_0001 .. team_0033
        { name: 'managed_team_power_factor', type: 'number', required: true, min: 50, max: 150 }, // 50-150% passo 5%
        { name: 'master_seed', type: 'text', required: true, min: 6, max: 64 }, // Determinismo
        { name: 'rules_frozen', type: 'json' }, // Regulamento técnico, financeiro e desportivo congelado na criação
        { name: 'teams_config_frozen', type: 'json' }, // Equipes e forças participantes congeladas
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_careers_user ON careers (user_id)',
        'CREATE INDEX idx_careers_updated ON careers (updated DESC)',
      ],
    })
    app.save(careers)

    const careersCollection = app.findCollectionByNameOrId('careers')
    const careersId = careersCollection.id

    // 2. Collection 'career_state': Ledger canônico de Finanças, Teto, Moral e Contratos
    // INV-04: teto regulamentar/financeiro bloqueante | INV-05: proteção financeira sem dinheiro mágico
    const careerState = new Collection({
      name: 'career_state',
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
        { name: 'cash_balance', type: 'number', required: true }, // Caixa atual em EUR / USD
        { name: 'cost_cap_budget', type: 'number', required: true, min: 0 }, // Teto orçamentário anual
        { name: 'cost_cap_spent', type: 'number', required: true, min: 0 }, // Gasto acumulado no teto
        { name: 'team_morale', type: 'number', required: true, min: 0, max: 100 }, // Moral geral da equipe (0-100)
        { name: 'sponsor_income_annual', type: 'number', required: true, min: 0 }, // Receita anual de patrocinadores
        { name: 'contracts_ledger', type: 'json' }, // Contratos vigentes: pilotos 1 e 2, motor, staff
        { name: 'facilities_state', type: 'json' }, // Níveis vigentes das 9 estruturas
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_career_state_career ON career_state (career_id)',
        'CREATE INDEX idx_career_state_user ON career_state (user_id)',
      ],
    })
    app.save(careerState)

    // 3. Collection 'career_receipts': Recibos de workflows transacionais / idempotência ENGINE-06
    const careerReceipts = new Collection({
      name: 'career_receipts',
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
        { name: 'action_type', type: 'text', required: true, min: 2, max: 60 }, // 'CAREER_BOOTSTRAP', 'CONTRACT_SIGNED', 'FACILITY_UPGRADE', etc.
        { name: 'idempotency_key', type: 'text', required: true, min: 8, max: 120 },
        { name: 'payload', type: 'json' },
        { name: 'status', type: 'text', required: true, min: 2, max: 30 }, // 'EXECUTED', 'REVERTED'
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_career_receipts_key ON career_receipts (idempotency_key)',
        'CREATE INDEX idx_career_receipts_career ON career_receipts (career_id)',
      ],
    })
    app.save(careerReceipts)
  },
  (app) => {
    try {
      const receipts = app.findCollectionByNameOrId('career_receipts')
      app.delete(receipts)
    } catch (_) {}

    try {
      const state = app.findCollectionByNameOrId('career_state')
      app.delete(state)
    } catch (_) {}

    try {
      const careers = app.findCollectionByNameOrId('careers')
      app.delete(careers)
    } catch (_) {}
  },
)
