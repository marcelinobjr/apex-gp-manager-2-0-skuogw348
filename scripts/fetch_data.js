import https from 'node:https'
import fs from 'node:fs'

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(get(res.headers.location))
        }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

async function main() {
  const driversRaw = await get(
    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/drivers.csv',
  )
  const attrsRaw = await get(
    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/APEX2_catalogos_v01/driver_attributes.csv',
  )

  fs.writeFileSync('scripts/drivers.csv', driversRaw)
  fs.writeFileSync('scripts/driver_attributes.csv', attrsRaw)

  console.log('drivers.csv lines:', driversRaw.trim().split('\n').length)
  console.log('attrs.csv lines:', attrsRaw.trim().split('\n').length)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
