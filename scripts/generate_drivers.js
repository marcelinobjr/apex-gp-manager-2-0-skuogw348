import fs from 'node:fs'

const driversCsv = fs.readFileSync('scripts/drivers.csv', 'utf8')
const attrsCsv = fs.readFileSync('scripts/driver_attributes.csv', 'utf8')

// Parse CSV helper
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].replace(/^\uFEFF/, '').split(',')
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Simple CSV parser handling quotes
    const values = []
    let cur = ''
    let inQuotes = false
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '"') {
        if (inQuotes && line[c + 1] === '"') {
          cur += '"'
          c++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    values.push(cur)

    const row = {}
    header.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : ''
    })
    rows.push(row)
  }
  return rows
}

const driverRows = parseCSV(driversCsv)
const attrRows = parseCSV(attrsCsv)

console.log('Parsed drivers count:', driverRows.length)
console.log('Parsed attrs count:', attrRows.length)

// Map attrs by driver_id
const attrsById = new Map()
for (const a of attrRows) {
  attrsById.set(a.driver_id, a)
}

// Check every driver has attrs
for (const d of driverRows) {
  if (!attrsById.has(d.driver_id)) {
    console.error('Missing attributes for driver:', d.driver_id, d.display_name)
  }
}

// Generate the TypeScript code
// Sort by driver_id (pil_0001 to pil_0188)
const sortedDrivers = [...driverRows].sort((a, b) => a.driver_id.localeCompare(b.driver_id))

const tsItems = sortedDrivers
  .map((d) => {
    const a = attrsById.get(d.driver_id)
    if (!a) throw new Error(`Missing attrs for ${d.driver_id}`)

    const numVal = d.preferred_number ? parseInt(d.preferred_number, 10) : undefined
    const birthVal = d.birth_date ? `'${d.birth_date}'` : 'undefined'
    const numProp = numVal !== undefined && !isNaN(numVal) ? `num: ${numVal}` : 'num: undefined'

    const attrsArray = [
      parseInt(a.qualifying_pace, 10),
      parseInt(a.race_pace, 10),
      parseInt(a.consistency, 10),
      parseInt(a.starts, 10),
      parseInt(a.overtaking, 10),
      parseInt(a.defending, 10),
      parseInt(a.wet_weather, 10),
      parseInt(a.tyre_management, 10),
      parseInt(a.adaptability, 10),
      parseInt(a.technical_feedback, 10),
      parseInt(a.pressure_control, 10),
      parseInt(a.teamwork, 10),
      parseInt(a.potential_max, 10),
      parseInt(a.development_rate, 10),
      `'${a.personality}'`,
    ].join(', ')

    return `  {
    id: '${d.driver_id}',
    name: ${JSON.stringify(d.display_name)},
    first: ${JSON.stringify(d.first_name)},
    last: ${JSON.stringify(d.last_name)},
    short: ${JSON.stringify(d.short_code)},
    nat: ${JSON.stringify(d.nationality_code)},
    birth: ${birthVal},
    ${numProp},
    attrs: [${attrsArray}],
  },`
  })
  .join('\n')

fs.writeFileSync('scripts/generated_driversRawData.ts', tsItems, 'utf8')
console.log('Wrote scripts/generated_driversRawData.ts successfully!')
