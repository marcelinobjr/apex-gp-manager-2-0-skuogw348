import fs from 'node:fs'

async function run() {
  const driversUrl =
    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/drivers.csv'
  const attrsUrl =
    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/driver_attributes.csv'

  const [driversRes, attrsRes] = await Promise.all([fetch(driversUrl), fetch(attrsUrl)])

  const driversText = await driversRes.text()
  const attrsText = await attrsRes.text()

  fs.writeFileSync('scripts/drivers_canonical.csv', driversText, 'utf8')
  fs.writeFileSync('scripts/attrs_canonical.csv', attrsText, 'utf8')

  console.log('drivers.csv length:', driversText.length)
  console.log('attrs.csv length:', attrsText.length)
}

run().catch(console.error)
