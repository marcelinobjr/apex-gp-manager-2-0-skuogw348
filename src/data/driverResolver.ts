/**
 * Resolvedor canônico de retratos de pilotos do APEX GP Manager 2.0.
 *
 * Mapeamento estrito 1:1 pil_XXXX -> DRV_XXXX.jpg derivado da coluna oficial
 * "Foto conferida: pilotos/DRV_XXXX.jpg" de drivers.csv (APEX2_catalogos_v01).
 *
 * REGRAS CANÔNICAS (QA-GESTAO-05A):
 * 1. NUNCA resolver por índice posicional, número da linha ou ordem alfabética.
 * 2. 188 pilotos oficiais mapeados individualmente com 0 colisões.
 * 3. IDs desconhecidos ou inválidos recebem placeholder padronizado e registram aviso no console.
 * 4. Os 67 retratos genéricos (DRV_0189 a DRV_0255) permanecem fora do mapa oficial de 188 pilotos.
 */

export const DRIVER_PORTRAITS_BASE_URL =
  'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/pilotos'

/**
 * Placeholder canônico padronizado para pilotos desconhecidos ou pendentes.
 */
export const DRIVER_PORTRAIT_PLACEHOLDER =
  'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/logo_base_programa/Capa.jpg'

/**
 * Mapeamento canônico explícito 1:1 (pil_XXXX -> DRV_XXXX).
 * 188 pilotos oficiais confirmados pela coluna notes de drivers.csv.
 */
export const DRIVER_PORTRAIT_BY_ID: Readonly<Record<string, string>> = Object.freeze({
  pil_0001: 'DRV_0041',
  pil_0002: 'DRV_0054',
  pil_0003: 'DRV_0060',
  pil_0004: 'DRV_0072',
  pil_0005: 'DRV_0107',
  pil_0006: 'DRV_0048',
  pil_0007: 'DRV_0066',
  pil_0008: 'DRV_0073',
  pil_0009: 'DRV_0012',
  pil_0010: 'DRV_0115',
  pil_0011: 'DRV_0024',
  pil_0012: 'DRV_0078',
  pil_0013: 'DRV_0031',
  pil_0014: 'DRV_0106',
  pil_0015: 'DRV_0032',
  pil_0016: 'DRV_0095',
  pil_0017: 'DRV_0102',
  pil_0018: 'DRV_0056',
  pil_0019: 'DRV_0074',
  pil_0020: 'DRV_0086',
  pil_0021: 'DRV_0015',
  pil_0022: 'DRV_0093',
  pil_0023: 'DRV_0006',
  pil_0024: 'DRV_0103',
  pil_0025: 'DRV_0025',
  pil_0026: 'DRV_0010',
  pil_0027: 'DRV_0071',
  pil_0028: 'DRV_0110',
  pil_0029: 'DRV_0084',
  pil_0030: 'DRV_0028',
  pil_0031: 'DRV_0070',
  pil_0032: 'DRV_0123',
  pil_0033: 'DRV_0081',
  pil_0034: 'DRV_0014',
  pil_0035: 'DRV_0104',
  pil_0036: 'DRV_0051',
  pil_0037: 'DRV_0049',
  pil_0038: 'DRV_0068',
  pil_0039: 'DRV_0097',
  pil_0040: 'DRV_0026',
  pil_0041: 'DRV_0061',
  pil_0042: 'DRV_0017',
  pil_0043: 'DRV_0092',
  pil_0044: 'DRV_0113',
  pil_0045: 'DRV_0001',
  pil_0046: 'DRV_0018',
  pil_0047: 'DRV_0065',
  pil_0048: 'DRV_0047',
  pil_0049: 'DRV_0045',
  pil_0050: 'DRV_0091',
  pil_0051: 'DRV_0058',
  pil_0052: 'DRV_0007',
  pil_0053: 'DRV_0036',
  pil_0054: 'DRV_0013',
  pil_0055: 'DRV_0053',
  pil_0056: 'DRV_0016',
  pil_0057: 'DRV_0019',
  pil_0058: 'DRV_0052',
  pil_0059: 'DRV_0021',
  pil_0060: 'DRV_0082',
  pil_0061: 'DRV_0043',
  pil_0062: 'DRV_0108',
  pil_0063: 'DRV_0077',
  pil_0064: 'DRV_0076',
  pil_0065: 'DRV_0114',
  pil_0066: 'DRV_0008',
  pil_0067: 'DRV_0112',
  pil_0068: 'DRV_0094',
  pil_0069: 'DRV_0096',
  pil_0070: 'DRV_0089',
  pil_0071: 'DRV_0105',
  pil_0072: 'DRV_0062',
  pil_0073: 'DRV_0027',
  pil_0074: 'DRV_0079',
  pil_0075: 'DRV_0038',
  pil_0076: 'DRV_0063',
  pil_0077: 'DRV_0057',
  pil_0078: 'DRV_0022',
  pil_0079: 'DRV_0109',
  pil_0080: 'DRV_0030',
  pil_0081: 'DRV_0055',
  pil_0082: 'DRV_0037',
  pil_0083: 'DRV_0137',
  pil_0084: 'DRV_0087',
  pil_0085: 'DRV_0003',
  pil_0086: 'DRV_0099',
  pil_0087: 'DRV_0111',
  pil_0088: 'DRV_0040',
  pil_0089: 'DRV_0020',
  pil_0090: 'DRV_0002',
  pil_0091: 'DRV_0034',
  pil_0092: 'DRV_0067',
  pil_0093: 'DRV_0023',
  pil_0094: 'DRV_0090',
  pil_0095: 'DRV_0004',
  pil_0096: 'DRV_0033',
  pil_0097: 'DRV_0059',
  pil_0098: 'DRV_0085',
  pil_0099: 'DRV_0046',
  pil_0100: 'DRV_0011',
  pil_0101: 'DRV_0044',
  pil_0102: 'DRV_0064',
  pil_0103: 'DRV_0042',
  pil_0104: 'DRV_0009',
  pil_0105: 'DRV_0050',
  pil_0106: 'DRV_0035',
  pil_0107: 'DRV_0005',
  pil_0108: 'DRV_0080',
  pil_0109: 'DRV_0069',
  pil_0110: 'DRV_0039',
  pil_0111: 'DRV_0119',
  pil_0112: 'DRV_0098',
  pil_0113: 'DRV_0128',
  pil_0114: 'DRV_0116',
  pil_0115: 'DRV_0126',
  pil_0116: 'DRV_0101',
  pil_0117: 'DRV_0121',
  pil_0118: 'DRV_0134',
  pil_0119: 'DRV_0129',
  pil_0120: 'DRV_0118',
  pil_0121: 'DRV_0120',
  pil_0122: 'DRV_0117',
  pil_0123: 'DRV_0133',
  pil_0124: 'DRV_0131',
  pil_0125: 'DRV_0130',
  pil_0126: 'DRV_0124',
  pil_0127: 'DRV_0122',
  pil_0128: 'DRV_0088',
  pil_0129: 'DRV_0029',
  pil_0130: 'DRV_0127',
  pil_0131: 'DRV_0100',
  pil_0132: 'DRV_0132',
  pil_0133: 'DRV_0083',
  pil_0134: 'DRV_0125',
  pil_0135: 'DRV_0147',
  pil_0136: 'DRV_0075',
  pil_0137: 'DRV_0135',
  pil_0138: 'DRV_0136',
  pil_0139: 'DRV_0138',
  pil_0140: 'DRV_0139',
  pil_0141: 'DRV_0140',
  pil_0142: 'DRV_0141',
  pil_0143: 'DRV_0142',
  pil_0144: 'DRV_0143',
  pil_0145: 'DRV_0144',
  pil_0146: 'DRV_0145',
  pil_0147: 'DRV_0146',
  pil_0148: 'DRV_0148',
  pil_0149: 'DRV_0149',
  pil_0150: 'DRV_0150',
  pil_0151: 'DRV_0151',
  pil_0152: 'DRV_0152',
  pil_0153: 'DRV_0153',
  pil_0154: 'DRV_0154',
  pil_0155: 'DRV_0155',
  pil_0156: 'DRV_0156',
  pil_0157: 'DRV_0157',
  pil_0158: 'DRV_0158',
  pil_0159: 'DRV_0159',
  pil_0160: 'DRV_0160',
  pil_0161: 'DRV_0161',
  pil_0162: 'DRV_0162',
  pil_0163: 'DRV_0163',
  pil_0164: 'DRV_0164',
  pil_0165: 'DRV_0165',
  pil_0166: 'DRV_0166',
  pil_0167: 'DRV_0167',
  pil_0168: 'DRV_0168',
  pil_0169: 'DRV_0169',
  pil_0170: 'DRV_0170',
  pil_0171: 'DRV_0171',
  pil_0172: 'DRV_0172',
  pil_0173: 'DRV_0173',
  pil_0174: 'DRV_0174',
  pil_0175: 'DRV_0175',
  pil_0176: 'DRV_0176',
  pil_0177: 'DRV_0177',
  pil_0178: 'DRV_0178',
  pil_0179: 'DRV_0179',
  pil_0180: 'DRV_0180',
  pil_0181: 'DRV_0181',
  pil_0182: 'DRV_0182',
  pil_0183: 'DRV_0183',
  pil_0184: 'DRV_0184',
  pil_0185: 'DRV_0185',
  pil_0186: 'DRV_0186',
  pil_0187: 'DRV_0187',
  pil_0188: 'DRV_0188',
})

const loggedUnknownIds = new Set<string>()

/**
 * Retorna o código do retrato (ex.: 'DRV_0041') a partir do ID canônico do piloto (ex.: 'pil_0001').
 */
export function getDriverPortraitCode(driverId: string | null | undefined): string | null {
  if (!driverId) return null
  const code = DRIVER_PORTRAIT_BY_ID[driverId]
  if (!code) {
    if (!loggedUnknownIds.has(driverId)) {
      loggedUnknownIds.add(driverId)
      console.warn(
        `[APEX Assets] ID de piloto não mapeado no resolvedor canônico: "${driverId}". Retornando placeholder padronizado.`,
      )
    }
    return null
  }
  return code
}

/**
 * Retorna a URL canônica do retrato do piloto.
 * Se o piloto não existir no catálogo comprovado, retorna o placeholder padronizado e registra a pendência.
 */
export function getDriverPortrait(driverId: string | null | undefined): string {
  const code = getDriverPortraitCode(driverId)
  if (!code) {
    return DRIVER_PORTRAIT_PLACEHOLDER
  }
  return `${DRIVER_PORTRAITS_BASE_URL}/${code}.jpg`
}
