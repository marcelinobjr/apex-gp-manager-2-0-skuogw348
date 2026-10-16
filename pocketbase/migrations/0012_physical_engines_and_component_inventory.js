// pocketbase/migrations/0012_physical_engines_and_component_inventory.js
// APEX GP Manager 2.0 - QA-GESTAO-05C2
// Inventário físico de motores e componentes do carro conforme seções 13.3 e 13.4 do Doc Mestre v2.2

migrate(
  (app) => {
    const carComponents = app.findCollectionByNameOrId('car_components')

    // 1. Adicionar campos físicos e de rastreabilidade a car_components
    // - physical_serial: string identificadora permanente da unidade física (ex: 'PU-7idgmb8ixhvn2yn-2026-C1-U1')
    if (!carComponents.fields.getByName('physical_serial')) {
      carComponents.fields.add(
        new TextField({
          name: 'physical_serial',
          required: false,
          min: 0,
          max: 120,
        }),
      )
    }

    // - season_year: ano da temporada de alocação da unidade
    if (!carComponents.fields.getByName('season_year')) {
      carComponents.fields.add(
        new NumberField({
          name: 'season_year',
          required: false,
          min: 1950,
          max: 2050,
          onlyInt: true,
        }),
      )
    }

    // - driver_id: piloto ao qual a unidade de potência está atribuída
    if (!carComponents.fields.getByName('driver_id')) {
      carComponents.fields.add(
        new TextField({
          name: 'driver_id',
          required: false,
          min: 0,
          max: 60,
        }),
      )
    }

    // - manufacturer_id: fornecedor/fabricante do motor (ex: 'ENG-0005', 'ENG-0001')
    if (!carComponents.fields.getByName('manufacturer_id')) {
      carComponents.fields.add(
        new TextField({
          name: 'manufacturer_id',
          required: false,
          min: 0,
          max: 60,
        }),
      )
    }

    // - status: estado operacional ('ACTIVE_INSTALLED', 'AVAILABLE_BENCH', 'MAINTENANCE', 'RETIRED')
    if (!carComponents.fields.getByName('status')) {
      carComponents.fields.add(
        new SelectField({
          name: 'status',
          required: false,
          values: ['ACTIVE_INSTALLED', 'AVAILABLE_BENCH', 'MAINTENANCE', 'RETIRED'],
          maxSelect: 1,
        }),
      )
    }

    // - mileage_km: quilometragem acumulada da unidade física
    if (!carComponents.fields.getByName('mileage_km')) {
      carComponents.fields.add(
        new NumberField({
          name: 'mileage_km',
          required: false,
          min: 0,
        }),
      )
    }

    // - penalty_incurred: flag indicando se a introdução desta unidade nova gerou penalidade FIA
    if (!carComponents.fields.getByName('penalty_incurred')) {
      carComponents.fields.add(
        new BoolField({
          name: 'penalty_incurred',
          required: false,
        }),
      )
    }

    // - usage_history: histórico persistente de utilizações, sessões, falhas e intervenções
    if (!carComponents.fields.getByName('usage_history')) {
      carComponents.fields.add(
        new JSONField({
          name: 'usage_history',
          required: false,
        }),
      )
    }

    // - installation_history: histórico de instalações e remoções no cockpit
    if (!carComponents.fields.getByName('installation_history')) {
      carComponents.fields.add(
        new JSONField({
          name: 'installation_history',
          required: false,
        }),
      )
    }

    // - is_installed: bool indicando se está instalada no chassi ativo
    if (!carComponents.fields.getByName('is_installed')) {
      carComponents.fields.add(
        new BoolField({
          name: 'is_installed',
          required: false,
        }),
      )
    }

    app.save(carComponents)

    // Adiciona índices para consulta rápida por piloto, temporada e serial físico
    carComponents.addIndex('idx_car_comp_serial', false, 'physical_serial', '')
    carComponents.addIndex(
      'idx_car_comp_driver_season',
      false,
      'career_id, driver_id, season_year',
      '',
    )
    app.save(carComponents)

    // 2. Backfill idempotente dos componentes existentes na base para garantir dados consistentes
    const existingRecords = app.findRecordsByFilter(
      'car_components',
      "physical_serial = '' || physical_serial = null",
      '',
      200,
      0,
    )
    for (let i = 0; i < existingRecords.length; i++) {
      const rec = existingRecords[i]
      const carIdx = rec.getInt('car_index') || 1
      const compType = rec.getString('component_type')
      const unitNum = rec.getInt('engine_unit_number') || 0
      const careerId = rec.getString('career_id')
      const recId = rec.id

      let serial = ''
      if (compType === 'engine') {
        serial = 'PU-' + careerId.substring(0, 8) + '-2026-C' + carIdx + '-U' + unitNum
        // Unidade 1 inicia como instalada; unidades 2, 3 e 4 ficam no banco de reserva (AVAILABLE_BENCH)
        const isInstalled = unitNum === 1
        rec.set('physical_serial', serial)
        rec.set('season_year', 2026)
        rec.set('status', isInstalled ? 'ACTIVE_INSTALLED' : 'AVAILABLE_BENCH')
        rec.set('is_installed', isInstalled)
        rec.set('mileage_km', 0)
        rec.set('penalty_incurred', false)
        rec.set('usage_history', [])
        rec.set('installation_history', [
          {
            car_index: carIdx,
            action: isInstalled ? 'INITIAL_INSTALL' : 'BENCH_ALLOCATION',
            timestamp: new Date().toISOString(),
          },
        ])
      } else {
        serial =
          'PART-' + careerId.substring(0, 8) + '-2026-C' + carIdx + '-' + compType.toUpperCase()
        rec.set('physical_serial', serial)
        rec.set('season_year', 2026)
        rec.set('status', 'ACTIVE_INSTALLED')
        rec.set('is_installed', true)
        rec.set('mileage_km', 0)
        rec.set('usage_history', [])
        rec.set('installation_history', [
          {
            car_index: carIdx,
            action: 'INITIAL_INSTALL',
            timestamp: new Date().toISOString(),
          },
        ])
      }
      app.save(rec)
    }
  },
  (app) => {
    try {
      const carComponents = app.findCollectionByNameOrId('car_components')
      carComponents.removeIndex('idx_car_comp_serial')
      carComponents.removeIndex('idx_car_comp_driver_season')
      carComponents.fields.removeByName('physical_serial')
      carComponents.fields.removeByName('season_year')
      carComponents.fields.removeByName('driver_id')
      carComponents.fields.removeByName('manufacturer_id')
      carComponents.fields.removeByName('status')
      carComponents.fields.removeByName('mileage_km')
      carComponents.fields.removeByName('penalty_incurred')
      carComponents.fields.removeByName('usage_history')
      carComponents.fields.removeByName('installation_history')
      carComponents.fields.removeByName('is_installed')
      app.save(carComponents)
    } catch (_) {}
  },
)
