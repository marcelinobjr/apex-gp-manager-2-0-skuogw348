const CATALOG_BASE_URL =
  'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/'

const CATALOGS = [
  {
    name: 'teams',
    file: 'teams.csv',
    fields: [
      'team_id',
      'display_name',
      'code',
      'country_code',
      'primary_color_hex',
      'secondary_color_hex',
      'emblem_asset_id',
      'team_image_asset_id',
      'side_view_asset_id',
      'small_logo_asset_id',
      'active',
      'notes',
    ],
    numbers: [],
    bools: ['active'],
    keys: ['team_id'],
    relations: {},
  },
  {
    name: 'drivers',
    file: 'drivers.csv',
    fields: [
      'driver_id',
      'display_name',
      'first_name',
      'last_name',
      'short_code',
      'nationality_code',
      'birth_date',
      'preferred_number',
      'portrait_asset_id',
      'active',
      'notes',
    ],
    numbers: ['preferred_number'],
    bools: ['active'],
    keys: ['driver_id'],
    relations: {},
  },
  {
    name: 'circuits',
    file: 'circuits.csv',
    fields: [
      'circuit_id',
      'display_name',
      'country_code',
      'city',
      'length_km',
      'turn_count',
      'layout_asset_id',
      'active',
      'notes',
      'tipo',
      'configuracao_tracado',
      'sentido_corrida',
      'abrasividade',
      'exigencia_aerodinamica',
      'exigencia_motor',
      'exigencia_tracao',
      'exigencia_frenagem',
      'carga_lateral',
      'recuperacao_energia',
      'dificuldade_ultrapassagem',
      'perda_pit_stop_s',
      'tempo_volta_ref_s',
      'altitude_m',
      'observacoes',
      'svg_asset_id',
      'svg_path',
      'track_path_id',
      'svg_track_length_px',
      'svg_m_por_px',
      'start_finish_progress',
      'race_direction',
      'pit_path_id',
      'pit_entry_progress',
      'pit_exit_progress',
      'fonte_dados',
      'pendencias_validacao',
      'start_line_progress',
      'length_geo_km',
    ],
    numbers: [
      'length_km',
      'turn_count',
      'perda_pit_stop_s',
      'tempo_volta_ref_s',
      'altitude_m',
      'svg_track_length_px',
      'svg_m_por_px',
      'start_finish_progress',
      'pit_entry_progress',
      'pit_exit_progress',
      'start_line_progress',
      'length_geo_km',
    ],
    bools: ['active'],
    keys: ['circuit_id'],
    relations: {},
  },
  {
    name: 'engines',
    file: 'engines.csv',
    fields: [
      'engine_id',
      'display_name',
      'country_code',
      'power',
      'reliability',
      'efficiency',
      'development_potential',
      'cost_tier',
      'logo_asset_id',
      'logo_file_path',
      'active',
      'notes',
    ],
    numbers: ['power', 'reliability', 'efficiency', 'development_potential'],
    bools: ['active'],
    keys: ['engine_id'],
    relations: {},
  },
  {
    name: 'managers',
    file: 'managers.csv',
    fields: [
      'manager_id',
      'display_order',
      'archetype_code',
      'display_name',
      'role',
      'headline_quote',
      'profile_text',
      'ideal_for_1',
      'ideal_for_2',
      'ideal_for_3',
      'signature',
      'image_asset_filename',
      'is_enabled',
      'record_type',
    ],
    numbers: ['display_order'],
    bools: ['is_enabled'],
    keys: ['manager_id'],
    relations: {},
  },
  {
    name: 'assets_manifest',
    file: 'assets_manifest.csv',
    fields: [
      'asset_id',
      'category',
      'file_path',
      'mime_type',
      'alt_text',
      'width_px',
      'height_px',
      'asset_version',
      'sha256',
      'source_reference',
      'rights_status',
      'active',
      'notes',
    ],
    numbers: ['width_px', 'height_px'],
    bools: ['active'],
    keys: ['asset_id'],
    relations: {},
  },
  {
    name: 'car_baselines',
    file: 'car_baselines.csv',
    fields: [
      'team_id',
      'baseline_version',
      'aero_downforce',
      'aero_efficiency',
      'mechanical_grip',
      'chassis_balance',
      'braking_performance',
      'tyre_preservation',
      'thermal_management',
      'chassis_reliability',
    ],
    numbers: [
      'aero_downforce',
      'aero_efficiency',
      'mechanical_grip',
      'chassis_balance',
      'braking_performance',
      'tyre_preservation',
      'thermal_management',
      'chassis_reliability',
    ],
    bools: [],
    keys: ['team_id'],
    relations: { team_id: ['teams', 'team_id'] },
  },
  {
    name: 'driver_attributes',
    file: 'driver_attributes.csv',
    fields: [
      'driver_id',
      'qualifying_pace',
      'race_pace',
      'consistency',
      'starts',
      'overtaking',
      'defending',
      'wet_weather',
      'tyre_management',
      'adaptability',
      'technical_feedback',
      'pressure_control',
      'teamwork',
      'potential_max',
      'development_rate',
      'personality',
    ],
    numbers: [
      'qualifying_pace',
      'race_pace',
      'consistency',
      'starts',
      'overtaking',
      'defending',
      'wet_weather',
      'tyre_management',
      'adaptability',
      'technical_feedback',
      'pressure_control',
      'teamwork',
      'potential_max',
      'development_rate',
    ],
    bools: [],
    keys: ['driver_id'],
    relations: { driver_id: ['drivers', 'driver_id'] },
  },
  {
    name: 'team_attributes',
    file: 'team_attributes.csv',
    fields: [
      'team_id',
      'design_center_level',
      'cfd_cluster_level',
      'wind_tunnel_level',
      'industrial_structure_level',
      'factory_level',
      'operations_center_level',
      'pit_stop_center_level',
      'simulator_level',
      'driver_academy_level',
    ],
    numbers: [
      'design_center_level',
      'cfd_cluster_level',
      'wind_tunnel_level',
      'industrial_structure_level',
      'factory_level',
      'operations_center_level',
      'pit_stop_center_level',
      'simulator_level',
      'driver_academy_level',
    ],
    bools: [],
    keys: ['team_id'],
    relations: { team_id: ['teams', 'team_id'] },
  },
  {
    name: 'manager_modifiers',
    file: 'manager_modifiers.csv',
    fields: [
      'manager_id',
      'slot',
      'modifier_target',
      'modifier_value',
      'modifier_kind',
      'unit',
      'mechanic_status',
      'source_image',
    ],
    numbers: ['slot', 'modifier_value'],
    bools: [],
    keys: ['manager_id', 'slot'],
    relations: { manager_id: ['managers', 'manager_id'] },
  },
]

function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((item) => item.some((value) => value !== ''))
}

function quoteFilter(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}

function fetchCsv(file) {
  const response = $http.send({
    url: CATALOG_BASE_URL + file,
    method: 'GET',
    timeout: 120,
    headers: { 'User-Agent': 'APEX-GP-Manager-Catalog-Importer' },
  })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(file + ': download falhou com HTTP ' + response.statusCode)
  }
  return response.raw
}

function relationValue(app, relation, sourceValue) {
  if (!sourceValue) return ''
  const targetCollection = relation[0]
  const targetField = relation[1]
  const matches = app.findRecordsByFilter(
    targetCollection,
    targetField + ' = ' + quoteFilter(sourceValue),
    '',
    1,
    0,
  )
  if (matches.length === 0)
    throw new Error('referência ' + sourceValue + ' não encontrada em ' + targetCollection)
  return matches[0].id
}

function existingRecord(app, config, values) {
  const filters = []
  for (const key of config.keys) {
    let value = values[key]
    if (config.relations[key]) value = relationValue(app, config.relations[key], value)
    if (config.numbers.indexOf(key) >= 0) filters.push(key + ' = ' + Number(value))
    else filters.push(key + ' = ' + quoteFilter(value))
  }
  const matches = app.findRecordsByFilter(config.name, filters.join(' && '), '', 1, 0)
  return matches.length > 0 ? matches[0] : null
}

function writeImportLog(app, runId, summary, startedAt) {
  const collection = app.findCollectionByNameOrId('import_logs')
  const log = new Record(collection)
  log.set('run_id', runId)
  log.set('catalog', summary.catalog)
  log.set('source_file', summary.file)
  log.set('rows_read', summary.rows_read)
  log.set('columns_detected', summary.columns_detected)
  log.set('rows_imported', summary.rows_imported)
  log.set('warnings', summary.warnings)
  log.set('errors', summary.errors)
  log.set('status', summary.status)
  log.set('messages', summary.messages)
  log.set('started_at', startedAt)
  log.set('finished_at', new Date().toISOString())
  app.save(log)
}

function importCatalog(app, config, runId) {
  const startedAt = new Date().toISOString()
  const summary = {
    catalog: config.name,
    file: config.file,
    rows_read: 0,
    columns_detected: 0,
    rows_imported: 0,
    warnings: 0,
    errors: 0,
    status: 'ok',
    messages: [],
  }

  try {
    const parsed = parseCsv(fetchCsv(config.file))
    if (parsed.length === 0) throw new Error(config.file + ': arquivo sem cabeçalho')
    const headers = parsed[0]
    summary.columns_detected = headers.length
    const missing = config.fields.filter((field) => headers.indexOf(field) < 0)
    const unexpected = headers.filter((field) => config.fields.indexOf(field) < 0)
    if (missing.length || unexpected.length) {
      throw new Error(
        config.file +
          ': cabeçalho divergente; ausentes=' +
          missing.join('|') +
          '; extras=' +
          unexpected.join('|'),
      )
    }

    const rows = parsed.slice(1)
    summary.rows_read = rows.length
    if (rows.length === 0) {
      summary.warnings += 1
      summary.status = 'warning'
      summary.messages.push(config.file + ': CSV válido, mas contém somente o cabeçalho')
    }

    const collection = app.findCollectionByNameOrId(config.name)
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      const original = {}
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
        original[headers[columnIndex]] = row[columnIndex] === undefined ? '' : row[columnIndex]
      }

      try {
        let record = existingRecord(app, config, original)
        if (!record) record = new Record(collection)

        for (const field of config.fields) {
          const sourceValue = original[field]
          if (config.relations[field]) {
            record.set(field, relationValue(app, config.relations[field], sourceValue))
          } else if (config.numbers.indexOf(field) >= 0) {
            if (sourceValue === '') {
              record.set(field, null)
            } else {
              const numeric = Number(sourceValue)
              if (!isFinite(numeric)) {
                summary.warnings += 1
                summary.messages.push(
                  config.file +
                    ': linha ' +
                    (rowIndex + 2) +
                    ' — valor numérico inválido em ' +
                    field,
                )
                record.set(field, null)
              } else {
                record.set(field, numeric)
              }
            }
          } else if (config.bools.indexOf(field) >= 0) {
            record.set(field, String(sourceValue).toLowerCase() === 'true')
          } else {
            record.set(field, sourceValue)
          }
        }
        record.set('raw', original)
        app.save(record)
        summary.rows_imported += 1
      } catch (error) {
        summary.errors += 1
        summary.messages.push(
          config.file +
            ': linha ' +
            (rowIndex + 2) +
            ' — ' +
            String(error && error.message ? error.message : error),
        )
      }
    }
  } catch (error) {
    summary.errors += 1
    summary.messages.push(String(error && error.message ? error.message : error))
  }

  if (summary.errors > 0) summary.status = summary.rows_imported > 0 ? 'partial' : 'error'
  else if (summary.warnings > 0) summary.status = 'warning'
  else
    summary.messages.push(
      config.file + ': ' + summary.rows_imported + ' registros sincronizados com sucesso',
    )

  writeImportLog(app, runId, summary, startedAt)
  return summary
}

function importAllCatalogs(app) {
  const runId = new Date().toISOString() + '-' + $security.randomString(8)
  const summaries = []
  for (const config of CATALOGS) summaries.push(importCatalog(app, config, runId))
  return { run_id: runId, catalogs: summaries }
}

// No PocketBase v0.36 Goja runtime, pb_hooks são executados por evento em um pool isolado.
// Toda lógica autocontida para importação deve estar encapsulada dentro da função do hook/route.
routerAdd(
  'POST',
  '/backend/v1/catalogs/import',
  (event) => {
    const result = (function runImport(app) {
      const CATALOG_BASE_URL =
        'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/'

      const CATALOG_CONFIGS = [
        {
          name: 'teams',
          file: 'teams.csv',
          fields: [
            'team_id',
            'display_name',
            'code',
            'country_code',
            'primary_color_hex',
            'secondary_color_hex',
            'emblem_asset_id',
            'team_image_asset_id',
            'side_view_asset_id',
            'small_logo_asset_id',
            'active',
            'notes',
          ],
          numbers: [],
          bools: ['active'],
          keys: ['team_id'],
          relations: {},
        },
        {
          name: 'drivers',
          file: 'drivers.csv',
          fields: [
            'driver_id',
            'display_name',
            'first_name',
            'last_name',
            'short_code',
            'nationality_code',
            'birth_date',
            'preferred_number',
            'portrait_asset_id',
            'active',
            'notes',
          ],
          numbers: ['preferred_number'],
          bools: ['active'],
          keys: ['driver_id'],
          relations: {},
        },
        {
          name: 'circuits',
          file: 'circuits.csv',
          fields: [
            'circuit_id',
            'display_name',
            'country_code',
            'city',
            'length_km',
            'turn_count',
            'layout_asset_id',
            'active',
            'notes',
            'tipo',
            'configuracao_tracado',
            'sentido_corrida',
            'abrasividade',
            'exigencia_aerodinamica',
            'exigencia_motor',
            'exigencia_tracao',
            'exigencia_frenagem',
            'carga_lateral',
            'recuperacao_energia',
            'dificuldade_ultrapassagem',
            'perda_pit_stop_s',
            'tempo_volta_ref_s',
            'altitude_m',
            'observacoes',
            'svg_asset_id',
            'svg_path',
            'track_path_id',
            'svg_track_length_px',
            'svg_m_por_px',
            'start_finish_progress',
            'race_direction',
            'pit_path_id',
            'pit_entry_progress',
            'pit_exit_progress',
            'fonte_dados',
            'pendencias_validacao',
            'start_line_progress',
            'length_geo_km',
          ],
          numbers: [
            'length_km',
            'turn_count',
            'perda_pit_stop_s',
            'tempo_volta_ref_s',
            'altitude_m',
            'svg_track_length_px',
            'svg_m_por_px',
            'start_finish_progress',
            'pit_entry_progress',
            'pit_exit_progress',
            'start_line_progress',
            'length_geo_km',
          ],
          bools: ['active'],
          keys: ['circuit_id'],
          relations: {},
        },
        {
          name: 'engines',
          file: 'engines.csv',
          fields: [
            'engine_id',
            'display_name',
            'country_code',
            'power',
            'reliability',
            'efficiency',
            'development_potential',
            'cost_tier',
            'logo_asset_id',
            'logo_file_path',
            'active',
            'notes',
          ],
          numbers: ['power', 'reliability', 'efficiency', 'development_potential'],
          bools: ['active'],
          keys: ['engine_id'],
          relations: {},
        },
        {
          name: 'managers',
          file: 'managers.csv',
          fields: [
            'manager_id',
            'display_order',
            'archetype_code',
            'display_name',
            'role',
            'headline_quote',
            'profile_text',
            'ideal_for_1',
            'ideal_for_2',
            'ideal_for_3',
            'signature',
            'image_asset_filename',
            'is_enabled',
            'record_type',
          ],
          numbers: ['display_order'],
          bools: ['is_enabled'],
          keys: ['manager_id'],
          relations: {},
        },
        {
          name: 'assets_manifest',
          file: 'assets_manifest.csv',
          fields: [
            'asset_id',
            'category',
            'file_path',
            'mime_type',
            'alt_text',
            'width_px',
            'height_px',
            'asset_version',
            'sha256',
            'source_reference',
            'rights_status',
            'active',
            'notes',
          ],
          numbers: ['width_px', 'height_px'],
          bools: ['active'],
          keys: ['asset_id'],
          relations: {},
        },
        {
          name: 'car_baselines',
          file: 'car_baselines.csv',
          fields: [
            'team_id',
            'baseline_version',
            'aero_downforce',
            'aero_efficiency',
            'mechanical_grip',
            'chassis_balance',
            'braking_performance',
            'tyre_preservation',
            'thermal_management',
            'chassis_reliability',
          ],
          numbers: [
            'aero_downforce',
            'aero_efficiency',
            'mechanical_grip',
            'chassis_balance',
            'braking_performance',
            'tyre_preservation',
            'thermal_management',
            'chassis_reliability',
          ],
          bools: [],
          keys: ['team_id'],
          relations: { team_id: ['teams', 'team_id'] },
        },
        {
          name: 'driver_attributes',
          file: 'driver_attributes.csv',
          fields: [
            'driver_id',
            'qualifying_pace',
            'race_pace',
            'consistency',
            'starts',
            'overtaking',
            'defending',
            'wet_weather',
            'tyre_management',
            'adaptability',
            'technical_feedback',
            'pressure_control',
            'teamwork',
            'potential_max',
            'development_rate',
            'personality',
          ],
          numbers: [
            'qualifying_pace',
            'race_pace',
            'consistency',
            'starts',
            'overtaking',
            'defending',
            'wet_weather',
            'tyre_management',
            'adaptability',
            'technical_feedback',
            'pressure_control',
            'teamwork',
            'potential_max',
            'development_rate',
          ],
          bools: [],
          keys: ['driver_id'],
          relations: { driver_id: ['drivers', 'driver_id'] },
        },
        {
          name: 'team_attributes',
          file: 'team_attributes.csv',
          fields: [
            'team_id',
            'design_center_level',
            'cfd_cluster_level',
            'wind_tunnel_level',
            'industrial_structure_level',
            'factory_level',
            'operations_center_level',
            'pit_stop_center_level',
            'simulator_level',
            'driver_academy_level',
          ],
          numbers: [
            'design_center_level',
            'cfd_cluster_level',
            'wind_tunnel_level',
            'industrial_structure_level',
            'factory_level',
            'operations_center_level',
            'pit_stop_center_level',
            'simulator_level',
            'driver_academy_level',
          ],
          bools: [],
          keys: ['team_id'],
          relations: { team_id: ['teams', 'team_id'] },
        },
        {
          name: 'manager_modifiers',
          file: 'manager_modifiers.csv',
          fields: [
            'manager_id',
            'slot',
            'modifier_target',
            'modifier_value',
            'modifier_kind',
            'unit',
            'mechanic_status',
            'source_image',
          ],
          numbers: ['slot', 'modifier_value'],
          bools: [],
          keys: ['manager_id', 'slot'],
          relations: { manager_id: ['managers', 'manager_id'] },
        },
      ]

      function parseCsv(text) {
        var source = String(text || '').replace(/^\uFEFF/, '')
        var rows = []
        var row = []
        var field = ''
        var quoted = false
        for (var index = 0; index < source.length; index += 1) {
          var char = source[index]
          if (quoted) {
            if (char === '"' && source[index + 1] === '"') {
              field += '"'
              index += 1
            } else if (char === '"') {
              quoted = false
            } else {
              field += char
            }
          } else if (char === '"') {
            quoted = true
          } else if (char === ',') {
            row.push(field)
            field = ''
          } else if (char === '\n') {
            row.push(field.replace(/\r$/, ''))
            rows.push(row)
            row = []
            field = ''
          } else {
            field += char
          }
        }
        if (field !== '' || row.length > 0) {
          row.push(field.replace(/\r$/, ''))
          rows.push(row)
        }
        return rows.filter(function (item) {
          return item.some(function (value) {
            return value !== ''
          })
        })
      }

      function quoteFilter(value) {
        return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
      }

      function fetchCsv(file) {
        var response = $http.send({
          url: CATALOG_BASE_URL + file,
          method: 'GET',
          timeout: 120,
          headers: { 'User-Agent': 'APEX-GP-Manager-Catalog-Importer' },
        })
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(file + ': download falhou com HTTP ' + response.statusCode)
        }
        return response.raw
      }

      function relationValue(app, relation, sourceValue) {
        if (!sourceValue) return ''
        var targetCollection = relation[0]
        var targetField = relation[1]
        var matches = app.findRecordsByFilter(
          targetCollection,
          targetField + ' = ' + quoteFilter(sourceValue),
          '',
          1,
          0,
        )
        if (matches.length === 0)
          throw new Error('referência ' + sourceValue + ' não encontrada em ' + targetCollection)
        return matches[0].id
      }

      function existingRecord(app, config, values) {
        var filters = []
        for (var k = 0; k < config.keys.length; k++) {
          var key = config.keys[k]
          var value = values[key]
          if (config.relations[key]) value = relationValue(app, config.relations[key], value)
          if (config.numbers.indexOf(key) >= 0) filters.push(key + ' = ' + Number(value))
          else filters.push(key + ' = ' + quoteFilter(value))
        }
        var matches = app.findRecordsByFilter(config.name, filters.join(' && '), '', 1, 0)
        return matches.length > 0 ? matches[0] : null
      }

      function writeImportLog(app, runId, summary, startedAt) {
        var collection = app.findCollectionByNameOrId('import_logs')
        var log = new Record(collection)
        log.set('run_id', runId)
        log.set('catalog', summary.catalog)
        log.set('source_file', summary.file)
        log.set('rows_read', summary.rows_read)
        log.set('columns_detected', summary.columns_detected)
        log.set('rows_imported', summary.rows_imported)
        log.set('warnings', summary.warnings)
        log.set('errors', summary.errors)
        log.set('status', summary.status)
        log.set('messages', summary.messages)
        log.set('started_at', startedAt)
        log.set('finished_at', new Date().toISOString())
        app.save(log)
      }

      function importCatalog(app, config, runId) {
        var startedAt = new Date().toISOString()
        var summary = {
          catalog: config.name,
          file: config.file,
          rows_read: 0,
          columns_detected: 0,
          rows_imported: 0,
          warnings: 0,
          errors: 0,
          status: 'ok',
          messages: [],
        }

        try {
          var parsed = parseCsv(fetchCsv(config.file))
          if (parsed.length === 0) throw new Error(config.file + ': arquivo sem cabeçalho')
          var headers = parsed[0]
          summary.columns_detected = headers.length
          var missing = config.fields.filter(function (field) {
            return headers.indexOf(field) < 0
          })
          var unexpected = headers.filter(function (field) {
            return config.fields.indexOf(field) < 0
          })
          if (missing.length || unexpected.length) {
            throw new Error(
              config.file +
                ': cabeçalho divergente; ausentes=' +
                missing.join('|') +
                '; extras=' +
                unexpected.join('|'),
            )
          }

          var rows = parsed.slice(1)
          summary.rows_read = rows.length
          if (rows.length === 0) {
            summary.warnings += 1
            summary.status = 'warning'
            summary.messages.push(config.file + ': CSV válido, mas contém somente o cabeçalho')
          }

          var collection = app.findCollectionByNameOrId(config.name)
          for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            var row = rows[rowIndex]
            var original = {}
            for (var colIndex = 0; colIndex < headers.length; colIndex += 1) {
              original[headers[colIndex]] = row[colIndex] === undefined ? '' : row[colIndex]
            }

            try {
              var record = existingRecord(app, config, original)
              if (!record) record = new Record(collection)

              for (var f = 0; f < config.fields.length; f++) {
                var field = config.fields[f]
                var sourceValue = original[field]
                if (config.relations[field]) {
                  record.set(field, relationValue(app, config.relations[field], sourceValue))
                } else if (config.numbers.indexOf(field) >= 0) {
                  if (sourceValue === '') {
                    record.set(field, null)
                  } else {
                    var numeric = Number(sourceValue)
                    if (!isFinite(numeric)) {
                      summary.warnings += 1
                      summary.messages.push(
                        config.file +
                          ': linha ' +
                          (rowIndex + 2) +
                          ' — valor numérico inválido em ' +
                          field,
                      )
                      record.set(field, null)
                    } else {
                      record.set(field, numeric)
                    }
                  }
                } else if (config.bools.indexOf(field) >= 0) {
                  record.set(field, String(sourceValue).toLowerCase() === 'true')
                } else {
                  record.set(field, sourceValue)
                }
              }
              record.set('raw', original)
              app.save(record)
              summary.rows_imported += 1
            } catch (err) {
              summary.errors += 1
              summary.messages.push(
                config.file +
                  ': linha ' +
                  (rowIndex + 2) +
                  ' — ' +
                  String(err && err.message ? err.message : err),
              )
            }
          }
        } catch (err) {
          summary.errors += 1
          summary.messages.push(String(err && err.message ? err.message : err))
        }

        if (summary.errors > 0) summary.status = summary.rows_imported > 0 ? 'partial' : 'error'
        else if (summary.warnings > 0) summary.status = 'warning'
        else
          summary.messages.push(
            config.file + ': ' + summary.rows_imported + ' registros sincronizados com sucesso',
          )

        writeImportLog(app, runId, summary, startedAt)
        return summary
      }

      var runId = new Date().toISOString() + '-' + $security.randomString(8)
      var summaries = []
      for (var c = 0; c < CATALOG_CONFIGS.length; c++) {
        summaries.push(importCatalog(app, CATALOG_CONFIGS[c], runId))
      }
      return { run_id: runId, catalogs: summaries }
    })(event.app)

    return event.json(200, result)
  },
  $apis.requireAuth(),
)

onBootstrap((event) => {
  event.next()
  try {
    if (event.app.countRecords('drivers') === 0) {
      console.log('APEX: iniciando importação inicial dos catálogos via onBootstrap autocontido')
      // Executa lógica inline
      var CATALOG_BASE_URL =
        'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/'

      var CATALOG_CONFIGS = [
        {
          name: 'teams',
          file: 'teams.csv',
          fields: [
            'team_id',
            'display_name',
            'code',
            'country_code',
            'primary_color_hex',
            'secondary_color_hex',
            'emblem_asset_id',
            'team_image_asset_id',
            'side_view_asset_id',
            'small_logo_asset_id',
            'active',
            'notes',
          ],
          numbers: [],
          bools: ['active'],
          keys: ['team_id'],
          relations: {},
        },
        {
          name: 'drivers',
          file: 'drivers.csv',
          fields: [
            'driver_id',
            'display_name',
            'first_name',
            'last_name',
            'short_code',
            'nationality_code',
            'birth_date',
            'preferred_number',
            'portrait_asset_id',
            'active',
            'notes',
          ],
          numbers: ['preferred_number'],
          bools: ['active'],
          keys: ['driver_id'],
          relations: {},
        },
        {
          name: 'circuits',
          file: 'circuits.csv',
          fields: [
            'circuit_id',
            'display_name',
            'country_code',
            'city',
            'length_km',
            'turn_count',
            'layout_asset_id',
            'active',
            'notes',
            'tipo',
            'configuracao_tracado',
            'sentido_corrida',
            'abrasividade',
            'exigencia_aerodinamica',
            'exigencia_motor',
            'exigencia_tracao',
            'exigencia_frenagem',
            'carga_lateral',
            'recuperacao_energia',
            'dificuldade_ultrapassagem',
            'perda_pit_stop_s',
            'tempo_volta_ref_s',
            'altitude_m',
            'observacoes',
            'svg_asset_id',
            'svg_path',
            'track_path_id',
            'svg_track_length_px',
            'svg_m_por_px',
            'start_finish_progress',
            'race_direction',
            'pit_path_id',
            'pit_entry_progress',
            'pit_exit_progress',
            'fonte_dados',
            'pendencias_validacao',
            'start_line_progress',
            'length_geo_km',
          ],
          numbers: [
            'length_km',
            'turn_count',
            'perda_pit_stop_s',
            'tempo_volta_ref_s',
            'altitude_m',
            'svg_track_length_px',
            'svg_m_por_px',
            'start_finish_progress',
            'pit_entry_progress',
            'pit_exit_progress',
            'start_line_progress',
            'length_geo_km',
          ],
          bools: ['active'],
          keys: ['circuit_id'],
          relations: {},
        },
        {
          name: 'engines',
          file: 'engines.csv',
          fields: [
            'engine_id',
            'display_name',
            'country_code',
            'power',
            'reliability',
            'efficiency',
            'development_potential',
            'cost_tier',
            'logo_asset_id',
            'logo_file_path',
            'active',
            'notes',
          ],
          numbers: ['power', 'reliability', 'efficiency', 'development_potential'],
          bools: ['active'],
          keys: ['engine_id'],
          relations: {},
        },
        {
          name: 'managers',
          file: 'managers.csv',
          fields: [
            'manager_id',
            'display_order',
            'archetype_code',
            'display_name',
            'role',
            'headline_quote',
            'profile_text',
            'ideal_for_1',
            'ideal_for_2',
            'ideal_for_3',
            'signature',
            'image_asset_filename',
            'is_enabled',
            'record_type',
          ],
          numbers: ['display_order'],
          bools: ['is_enabled'],
          keys: ['manager_id'],
          relations: {},
        },
        {
          name: 'assets_manifest',
          file: 'assets_manifest.csv',
          fields: [
            'asset_id',
            'category',
            'file_path',
            'mime_type',
            'alt_text',
            'width_px',
            'height_px',
            'asset_version',
            'sha256',
            'source_reference',
            'rights_status',
            'active',
            'notes',
          ],
          numbers: ['width_px', 'height_px'],
          bools: ['active'],
          keys: ['asset_id'],
          relations: {},
        },
        {
          name: 'car_baselines',
          file: 'car_baselines.csv',
          fields: [
            'team_id',
            'baseline_version',
            'aero_downforce',
            'aero_efficiency',
            'mechanical_grip',
            'chassis_balance',
            'braking_performance',
            'tyre_preservation',
            'thermal_management',
            'chassis_reliability',
          ],
          numbers: [
            'aero_downforce',
            'aero_efficiency',
            'mechanical_grip',
            'chassis_balance',
            'braking_performance',
            'tyre_preservation',
            'thermal_management',
            'chassis_reliability',
          ],
          bools: [],
          keys: ['team_id'],
          relations: { team_id: ['teams', 'team_id'] },
        },
        {
          name: 'driver_attributes',
          file: 'driver_attributes.csv',
          fields: [
            'driver_id',
            'qualifying_pace',
            'race_pace',
            'consistency',
            'starts',
            'overtaking',
            'defending',
            'wet_weather',
            'tyre_management',
            'adaptability',
            'technical_feedback',
            'pressure_control',
            'teamwork',
            'potential_max',
            'development_rate',
            'personality',
          ],
          numbers: [
            'qualifying_pace',
            'race_pace',
            'consistency',
            'starts',
            'overtaking',
            'defending',
            'wet_weather',
            'tyre_management',
            'adaptability',
            'technical_feedback',
            'pressure_control',
            'teamwork',
            'potential_max',
            'development_rate',
          ],
          bools: [],
          keys: ['driver_id'],
          relations: { driver_id: ['drivers', 'driver_id'] },
        },
        {
          name: 'team_attributes',
          file: 'team_attributes.csv',
          fields: [
            'team_id',
            'design_center_level',
            'cfd_cluster_level',
            'wind_tunnel_level',
            'industrial_structure_level',
            'factory_level',
            'operations_center_level',
            'pit_stop_center_level',
            'simulator_level',
            'driver_academy_level',
          ],
          numbers: [
            'design_center_level',
            'cfd_cluster_level',
            'wind_tunnel_level',
            'industrial_structure_level',
            'factory_level',
            'operations_center_level',
            'pit_stop_center_level',
            'simulator_level',
            'driver_academy_level',
          ],
          bools: [],
          keys: ['team_id'],
          relations: { team_id: ['teams', 'team_id'] },
        },
        {
          name: 'manager_modifiers',
          file: 'manager_modifiers.csv',
          fields: [
            'manager_id',
            'slot',
            'modifier_target',
            'modifier_value',
            'modifier_kind',
            'unit',
            'mechanic_status',
            'source_image',
          ],
          numbers: ['slot', 'modifier_value'],
          bools: [],
          keys: ['manager_id', 'slot'],
          relations: { manager_id: ['managers', 'manager_id'] },
        },
      ]

      function parseCsv(text) {
        var source = String(text || '').replace(/^\uFEFF/, '')
        var rows = []
        var row = []
        var field = ''
        var quoted = false
        for (var index = 0; index < source.length; index += 1) {
          var char = source[index]
          if (quoted) {
            if (char === '"' && source[index + 1] === '"') {
              field += '"'
              index += 1
            } else if (char === '"') {
              quoted = false
            } else {
              field += char
            }
          } else if (char === '"') {
            quoted = true
          } else if (char === ',') {
            row.push(field)
            field = ''
          } else if (char === '\n') {
            row.push(field.replace(/\r$/, ''))
            rows.push(row)
            row = []
            field = ''
          } else {
            field += char
          }
        }
        if (field !== '' || row.length > 0) {
          row.push(field.replace(/\r$/, ''))
          rows.push(row)
        }
        return rows.filter(function (item) {
          return item.some(function (value) {
            return value !== ''
          })
        })
      }

      function quoteFilter(value) {
        return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
      }

      function fetchCsv(file) {
        var response = $http.send({
          url: CATALOG_BASE_URL + file,
          method: 'GET',
          timeout: 120,
          headers: { 'User-Agent': 'APEX-GP-Manager-Catalog-Importer' },
        })
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(file + ': download falhou com HTTP ' + response.statusCode)
        }
        return response.raw
      }

      function relationValue(app, relation, sourceValue) {
        if (!sourceValue) return ''
        var targetCollection = relation[0]
        var targetField = relation[1]
        var matches = app.findRecordsByFilter(
          targetCollection,
          targetField + ' = ' + quoteFilter(sourceValue),
          '',
          1,
          0,
        )
        if (matches.length === 0)
          throw new Error('referência ' + sourceValue + ' não encontrada em ' + targetCollection)
        return matches[0].id
      }

      function existingRecord(app, config, values) {
        var filters = []
        for (var k = 0; k < config.keys.length; k++) {
          var key = config.keys[k]
          var value = values[key]
          if (config.relations[key]) value = relationValue(app, config.relations[key], value)
          if (config.numbers.indexOf(key) >= 0) filters.push(key + ' = ' + Number(value))
          else filters.push(key + ' = ' + quoteFilter(value))
        }
        var matches = app.findRecordsByFilter(config.name, filters.join(' && '), '', 1, 0)
        return matches.length > 0 ? matches[0] : null
      }

      function writeImportLog(app, runId, summary, startedAt) {
        var collection = app.findCollectionByNameOrId('import_logs')
        var log = new Record(collection)
        log.set('run_id', runId)
        log.set('catalog', summary.catalog)
        log.set('source_file', summary.file)
        log.set('rows_read', summary.rows_read)
        log.set('columns_detected', summary.columns_detected)
        log.set('rows_imported', summary.rows_imported)
        log.set('warnings', summary.warnings)
        log.set('errors', summary.errors)
        log.set('status', summary.status)
        log.set('messages', summary.messages)
        log.set('started_at', startedAt)
        log.set('finished_at', new Date().toISOString())
        app.save(log)
      }

      function importCatalog(app, config, runId) {
        var startedAt = new Date().toISOString()
        var summary = {
          catalog: config.name,
          file: config.file,
          rows_read: 0,
          columns_detected: 0,
          rows_imported: 0,
          warnings: 0,
          errors: 0,
          status: 'ok',
          messages: [],
        }

        try {
          var parsed = parseCsv(fetchCsv(config.file))
          if (parsed.length === 0) throw new Error(config.file + ': arquivo sem cabeçalho')
          var headers = parsed[0]
          summary.columns_detected = headers.length
          var missing = config.fields.filter(function (field) {
            return headers.indexOf(field) < 0
          })
          var unexpected = headers.filter(function (field) {
            return config.fields.indexOf(field) < 0
          })
          if (missing.length || unexpected.length) {
            throw new Error(
              config.file +
                ': cabeçalho divergente; ausentes=' +
                missing.join('|') +
                '; extras=' +
                unexpected.join('|'),
            )
          }

          var rows = parsed.slice(1)
          summary.rows_read = rows.length
          if (rows.length === 0) {
            summary.warnings += 1
            summary.status = 'warning'
            summary.messages.push(config.file + ': CSV válido, mas contém somente o cabeçalho')
          }

          var collection = app.findCollectionByNameOrId(config.name)
          for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            var row = rows[rowIndex]
            var original = {}
            for (var colIndex = 0; colIndex < headers.length; colIndex += 1) {
              original[headers[colIndex]] = row[colIndex] === undefined ? '' : row[colIndex]
            }

            try {
              var record = existingRecord(app, config, original)
              if (!record) record = new Record(collection)

              for (var f = 0; f < config.fields.length; f++) {
                var field = config.fields[f]
                var sourceValue = original[field]
                if (config.relations[field]) {
                  record.set(field, relationValue(app, config.relations[field], sourceValue))
                } else if (config.numbers.indexOf(field) >= 0) {
                  if (sourceValue === '') {
                    record.set(field, null)
                  } else {
                    var numeric = Number(sourceValue)
                    if (!isFinite(numeric)) {
                      summary.warnings += 1
                      summary.messages.push(
                        config.file +
                          ': linha ' +
                          (rowIndex + 2) +
                          ' — valor numérico inválido em ' +
                          field,
                      )
                      record.set(field, null)
                    } else {
                      record.set(field, numeric)
                    }
                  }
                } else if (config.bools.indexOf(field) >= 0) {
                  record.set(field, String(sourceValue).toLowerCase() === 'true')
                } else {
                  record.set(field, sourceValue)
                }
              }
              record.set('raw', original)
              app.save(record)
              summary.rows_imported += 1
            } catch (err) {
              summary.errors += 1
              summary.messages.push(
                config.file +
                  ': linha ' +
                  (rowIndex + 2) +
                  ' — ' +
                  String(err && err.message ? err.message : err),
              )
            }
          }
        } catch (err) {
          summary.errors += 1
          summary.messages.push(String(err && err.message ? err.message : err))
        }

        if (summary.errors > 0) summary.status = summary.rows_imported > 0 ? 'partial' : 'error'
        else if (summary.warnings > 0) summary.status = 'warning'
        else
          summary.messages.push(
            config.file + ': ' + summary.rows_imported + ' registros sincronizados com sucesso',
          )

        writeImportLog(app, runId, summary, startedAt)
        return summary
      }

      var runId = new Date().toISOString() + '-' + $security.randomString(8)
      for (var c = 0; c < CATALOG_CONFIGS.length; c++) {
        var summary = importCatalog(event.app, CATALOG_CONFIGS[c], runId)
        console.log(
          'APEX: catálogo importado:',
          summary.catalog,
          summary.status,
          summary.rows_imported,
        )
      }
      console.log('APEX: importação inicial bootstrap concluída com sucesso')
    }
  } catch (error) {
    console.error('APEX: falha na importação inicial', error)
  }
})
