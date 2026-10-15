migrate(
  (app) => {
    const systemFields = () => [
      { name: 'raw', type: 'json', maxSize: 2097152 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    const createCatalog = (name, fields, indexes) => {
      const collection = new Collection({
        name,
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [...fields, ...systemFields()],
        indexes,
      })
      app.save(collection)
      return collection
    }

    const teams = createCatalog(
      'teams',
      [
        { name: 'team_id', type: 'text', required: true },
        { name: 'display_name', type: 'text', required: true },
        { name: 'code', type: 'text' },
        { name: 'country_code', type: 'text' },
        { name: 'primary_color_hex', type: 'text' },
        { name: 'secondary_color_hex', type: 'text' },
        { name: 'emblem_asset_id', type: 'text' },
        { name: 'team_image_asset_id', type: 'text' },
        { name: 'side_view_asset_id', type: 'text' },
        { name: 'small_logo_asset_id', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'notes', type: 'text' },
      ],
      [
        'CREATE UNIQUE INDEX idx_teams_team_id ON teams (team_id)',
        'CREATE INDEX idx_teams_display_name ON teams (display_name)',
      ],
    )

    const drivers = createCatalog(
      'drivers',
      [
        { name: 'driver_id', type: 'text', required: true },
        { name: 'display_name', type: 'text', required: true },
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'short_code', type: 'text' },
        { name: 'nationality_code', type: 'text' },
        { name: 'birth_date', type: 'text' },
        { name: 'preferred_number', type: 'number', onlyInt: true },
        { name: 'portrait_asset_id', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'notes', type: 'text' },
      ],
      [
        'CREATE UNIQUE INDEX idx_drivers_driver_id ON drivers (driver_id)',
        'CREATE INDEX idx_drivers_display_name ON drivers (display_name)',
      ],
    )

    createCatalog(
      'circuits',
      [
        { name: 'circuit_id', type: 'text', required: true },
        { name: 'display_name', type: 'text', required: true },
        { name: 'country_code', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'length_km', type: 'number' },
        { name: 'turn_count', type: 'number', onlyInt: true },
        { name: 'layout_asset_id', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'notes', type: 'text' },
        { name: 'tipo', type: 'text' },
        { name: 'configuracao_tracado', type: 'text' },
        { name: 'sentido_corrida', type: 'text' },
        { name: 'abrasividade', type: 'text' },
        { name: 'exigencia_aerodinamica', type: 'text' },
        { name: 'exigencia_motor', type: 'text' },
        { name: 'exigencia_tracao', type: 'text' },
        { name: 'exigencia_frenagem', type: 'text' },
        { name: 'carga_lateral', type: 'text' },
        { name: 'recuperacao_energia', type: 'text' },
        { name: 'dificuldade_ultrapassagem', type: 'text' },
        { name: 'perda_pit_stop_s', type: 'number' },
        { name: 'tempo_volta_ref_s', type: 'number' },
        { name: 'altitude_m', type: 'number', onlyInt: true },
        { name: 'observacoes', type: 'text' },
        { name: 'svg_asset_id', type: 'text' },
        { name: 'svg_path', type: 'text' },
        { name: 'track_path_id', type: 'text' },
        { name: 'svg_track_length_px', type: 'number' },
        { name: 'svg_m_por_px', type: 'number' },
        { name: 'start_finish_progress', type: 'number' },
        { name: 'race_direction', type: 'text' },
        { name: 'pit_path_id', type: 'text' },
        { name: 'pit_entry_progress', type: 'number' },
        { name: 'pit_exit_progress', type: 'number' },
        { name: 'fonte_dados', type: 'text' },
        { name: 'pendencias_validacao', type: 'text' },
        { name: 'start_line_progress', type: 'number' },
        { name: 'length_geo_km', type: 'number' },
      ],
      [
        'CREATE UNIQUE INDEX idx_circuits_circuit_id ON circuits (circuit_id)',
        'CREATE INDEX idx_circuits_display_name ON circuits (display_name)',
      ],
    )

    createCatalog(
      'engines',
      [
        { name: 'engine_id', type: 'text', required: true },
        { name: 'display_name', type: 'text', required: true },
        { name: 'country_code', type: 'text' },
        { name: 'power', type: 'number', onlyInt: true },
        { name: 'reliability', type: 'number', onlyInt: true },
        { name: 'efficiency', type: 'number', onlyInt: true },
        { name: 'development_potential', type: 'number', onlyInt: true },
        { name: 'cost_tier', type: 'text' },
        { name: 'logo_asset_id', type: 'text' },
        { name: 'logo_file_path', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'notes', type: 'text' },
      ],
      [
        'CREATE UNIQUE INDEX idx_engines_engine_id ON engines (engine_id)',
        'CREATE INDEX idx_engines_display_name ON engines (display_name)',
      ],
    )

    const managers = createCatalog(
      'managers',
      [
        { name: 'manager_id', type: 'text', required: true },
        { name: 'display_order', type: 'number', onlyInt: true },
        { name: 'archetype_code', type: 'text' },
        { name: 'display_name', type: 'text', required: true },
        { name: 'role', type: 'text' },
        { name: 'headline_quote', type: 'text' },
        { name: 'profile_text', type: 'text' },
        { name: 'ideal_for_1', type: 'text' },
        { name: 'ideal_for_2', type: 'text' },
        { name: 'ideal_for_3', type: 'text' },
        { name: 'signature', type: 'text' },
        { name: 'image_asset_filename', type: 'text' },
        { name: 'is_enabled', type: 'bool' },
        { name: 'record_type', type: 'text' },
      ],
      [
        'CREATE UNIQUE INDEX idx_managers_manager_id ON managers (manager_id)',
        'CREATE INDEX idx_managers_display_name ON managers (display_name)',
      ],
    )

    createCatalog(
      'assets_manifest',
      [
        { name: 'asset_id', type: 'text', required: true },
        { name: 'category', type: 'text' },
        { name: 'file_path', type: 'text' },
        { name: 'mime_type', type: 'text' },
        { name: 'alt_text', type: 'text' },
        { name: 'width_px', type: 'number', onlyInt: true },
        { name: 'height_px', type: 'number', onlyInt: true },
        { name: 'asset_version', type: 'text' },
        { name: 'sha256', type: 'text' },
        { name: 'source_reference', type: 'text' },
        { name: 'rights_status', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'notes', type: 'text' },
      ],
      [
        'CREATE UNIQUE INDEX idx_assets_manifest_asset_id ON assets_manifest (asset_id)',
        'CREATE INDEX idx_assets_manifest_category ON assets_manifest (category)',
      ],
    )

    createCatalog(
      'car_baselines',
      [
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'baseline_version', type: 'text' },
        { name: 'aero_downforce', type: 'number', onlyInt: true },
        { name: 'aero_efficiency', type: 'number', onlyInt: true },
        { name: 'mechanical_grip', type: 'number', onlyInt: true },
        { name: 'chassis_balance', type: 'number', onlyInt: true },
        { name: 'braking_performance', type: 'number', onlyInt: true },
        { name: 'tyre_preservation', type: 'number', onlyInt: true },
        { name: 'thermal_management', type: 'number', onlyInt: true },
        { name: 'chassis_reliability', type: 'number', onlyInt: true },
      ],
      ['CREATE UNIQUE INDEX idx_car_baselines_team_id ON car_baselines (team_id)'],
    )

    createCatalog(
      'driver_attributes',
      [
        {
          name: 'driver_id',
          type: 'relation',
          required: true,
          collectionId: drivers.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'qualifying_pace', type: 'number', onlyInt: true },
        { name: 'race_pace', type: 'number', onlyInt: true },
        { name: 'consistency', type: 'number', onlyInt: true },
        { name: 'starts', type: 'number', onlyInt: true },
        { name: 'overtaking', type: 'number', onlyInt: true },
        { name: 'defending', type: 'number', onlyInt: true },
        { name: 'wet_weather', type: 'number', onlyInt: true },
        { name: 'tyre_management', type: 'number', onlyInt: true },
        { name: 'adaptability', type: 'number', onlyInt: true },
        { name: 'technical_feedback', type: 'number', onlyInt: true },
        { name: 'pressure_control', type: 'number', onlyInt: true },
        { name: 'teamwork', type: 'number', onlyInt: true },
        { name: 'potential_max', type: 'number', onlyInt: true },
        { name: 'development_rate', type: 'number', onlyInt: true },
        { name: 'personality', type: 'text' },
      ],
      ['CREATE UNIQUE INDEX idx_driver_attributes_driver_id ON driver_attributes (driver_id)'],
    )

    createCatalog(
      'team_attributes',
      [
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'design_center_level', type: 'number', onlyInt: true },
        { name: 'cfd_cluster_level', type: 'number', onlyInt: true },
        { name: 'wind_tunnel_level', type: 'number', onlyInt: true },
        { name: 'industrial_structure_level', type: 'number', onlyInt: true },
        { name: 'factory_level', type: 'number', onlyInt: true },
        { name: 'operations_center_level', type: 'number', onlyInt: true },
        { name: 'pit_stop_center_level', type: 'number', onlyInt: true },
        { name: 'simulator_level', type: 'number', onlyInt: true },
        { name: 'driver_academy_level', type: 'number', onlyInt: true },
      ],
      ['CREATE UNIQUE INDEX idx_team_attributes_team_id ON team_attributes (team_id)'],
    )

    createCatalog(
      'manager_modifiers',
      [
        {
          name: 'manager_id',
          type: 'relation',
          required: true,
          collectionId: managers.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'slot', type: 'number', onlyInt: true },
        { name: 'modifier_target', type: 'text' },
        { name: 'modifier_value', type: 'number' },
        { name: 'modifier_kind', type: 'text' },
        { name: 'unit', type: 'text' },
        { name: 'mechanic_status', type: 'text' },
        { name: 'source_image', type: 'text' },
      ],
      [
        'CREATE UNIQUE INDEX idx_manager_modifiers_manager_slot ON manager_modifiers (manager_id, slot)',
      ],
    )

    const importLogs = new Collection({
      name: 'import_logs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'run_id', type: 'text', required: true },
        { name: 'catalog', type: 'text', required: true },
        { name: 'source_file', type: 'text', required: true },
        { name: 'rows_read', type: 'number', onlyInt: true },
        { name: 'columns_detected', type: 'number', onlyInt: true },
        { name: 'rows_imported', type: 'number', onlyInt: true },
        { name: 'warnings', type: 'number', onlyInt: true },
        { name: 'errors', type: 'number', onlyInt: true },
        { name: 'status', type: 'text' },
        { name: 'messages', type: 'json', maxSize: 2097152 },
        { name: 'started_at', type: 'date' },
        { name: 'finished_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_import_logs_run_catalog ON import_logs (run_id, catalog)',
        'CREATE INDEX idx_import_logs_created ON import_logs (created DESC)',
      ],
    })
    app.save(importLogs)
  },
  (app) => {
    const names = [
      'import_logs',
      'manager_modifiers',
      'team_attributes',
      'driver_attributes',
      'car_baselines',
      'assets_manifest',
      'managers',
      'engines',
      'circuits',
      'drivers',
      'teams',
    ]
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
