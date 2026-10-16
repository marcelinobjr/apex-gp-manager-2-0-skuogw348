import {
  getDriverPortrait,
  getDriverPortraitCode,
  DRIVER_PORTRAIT_BY_ID,
  DRIVER_PORTRAITS_BASE_URL,
  DRIVER_PORTRAIT_PLACEHOLDER,
} from '@/data/driverResolver'

export {
  getDriverPortrait,
  getDriverPortraitCode,
  DRIVER_PORTRAIT_BY_ID,
  DRIVER_PORTRAITS_BASE_URL,
  DRIVER_PORTRAIT_PLACEHOLDER,
}

const asset = (path: string) =>
  `https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

export const assets = {
  branding: {
    // Regras canônicas de branding:
    // - Capa.jpg como hero da Index e painel visual de auth
    cover: asset('logo_base_programa/Capa.jpg'),
    // - fundo01.jpg como textura global sob overlay escuro
    background: asset('logo_base_programa/fundo01.jpg'),
    // - Logo sólido/não transparente: só em superfícies claras sólidas / favicon
    logo: asset('logo_base_programa/Logo APEX GP Manager 2.0.png'),
    // - Logo transparente: somente sobre fotos / superfícies escuras
    logoTransparent: asset('logo_base_programa/Logo APEX GP Manager 2.0-transparente.png'),
    // - Logo reduzida: para rodapé, miniaturas e visualizações compactas
    logoReduced: asset('logo_reduzida/Logo reduzida APEX GP Manager 2.0.png'),
  },
  circuit: (index: number | string) => {
    const n = typeof index === 'string' ? parseInt(index.replace(/\D/g, ''), 10) : Number(index)
    const files: Record<number, string> = {
      1: '01-Australia.svg',
      2: '02-China.svg',
      3: '03-Japao.svg',
      4: '04-Bahrein.svg',
      5: '05-Arabia_Saudita.svg',
      6: '06-Miami.svg',
      7: '07-Canada.svg',
      8: '08-Monaco.svg',
      9: '09-Barcelona.svg',
      10: '10-Madrid.svg',
      11: '11-Austria.svg',
      12: '12-Silverstone.svg',
      13: '13-Belgica.svg',
      14: '14-Hungria.svg',
      15: '15-Holanda.svg',
      16: '16-Monza.svg',
      17: '17-Azerbaijao.svg',
      18: '18-Singapura.svg',
      19: '19-USA.svg',
      20: '20-Mexico.svg',
      21: '21-Brasil.svg',
      22: '22-Las_Vegas.svg',
      23: '23-Qatar.svg',
      24: '24-Abu_Dhabi.svg',
      25: '25-Imola.svg',
      26: '26-Portimao.svg',
      27: '27-Istambul.svg',
      28: '28-Sepang.svg',
      29: '29-Nurburgring.svg',
      30: '30-Hockenheim.svg',
      31: '31-Paul_Ricard.svg',
      32: '32-Magny_Cours.svg',
      33: '33-Adelaide.svg',
      34: '34-Estoril.svg',
      35: '35-Kyalami.svg',
      36: '36-Jerez.svg',
      37: '37-Mugello.svg',
      38: '38-Indianapolis.svg',
      39: '39-Fuji.svg',
      40: '40-Jacarepagua.svg',
      41: '41-Brasilia.svg',
      42: '42-Goiania.svg',
      43: '43-Sochi.svg',
    }
    const fileName = files[n] || `${String(n).padStart(2, '0')}.svg`
    return asset(`APEX2_circuitos_43/circuitos/svg/${fileName}`)
  },
  team: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`equipes/equipe_${num.padStart(4, '0')}.jpg`)
  },
  emblem: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`emblemas/emblema_${num.padStart(4, '0')}.jpg`)
  },
  /**
   * Retorna o retrato canônico do piloto.
   * Suporta o ID canônico 'pil_XXXX' (resolução 1:1 comprovada) ou fallback via resolvedor.
   */
  driver: (driverIdOrIndex: number | string) => {
    if (typeof driverIdOrIndex === 'string' && driverIdOrIndex.startsWith('pil_')) {
      return getDriverPortrait(driverIdOrIndex)
    }
    // Se for string numérica ou number puro, converte para pil_XXXX para resolução canônica
    const num =
      typeof driverIdOrIndex === 'string'
        ? driverIdOrIndex.replace(/\D/g, '')
        : String(driverIdOrIndex)
    if (num) {
      const canonicalId = `pil_${num.padStart(4, '0')}`
      if (canonicalId in DRIVER_PORTRAIT_BY_ID) {
        return getDriverPortrait(canonicalId)
      }
    }
    // Caso de ID genérico DRV_XXXX direto
    if (typeof driverIdOrIndex === 'string' && driverIdOrIndex.startsWith('DRV_')) {
      return `${DRIVER_PORTRAITS_BASE_URL}/${driverIdOrIndex}.jpg`
    }
    return getDriverPortrait(typeof driverIdOrIndex === 'string' ? driverIdOrIndex : undefined)
  },
  engine: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`motores/motor_${num.padStart(3, '0')}.jpg`)
  },
  structure: (idOrIndexOrCode: number | string) => {
    const structureMap: Record<string, string> = {
      '1': 'Centro_de_Design.jpg',
      'STR-001': 'Centro_de_Design.jpg',
      design_center: 'Centro_de_Design.jpg',
      '2': 'Cluster_CFD.jpg',
      'STR-002': 'Cluster_CFD.jpg',
      cfd_cluster: 'Cluster_CFD.jpg',
      '3': 'Túnel_de_vento.jpg',
      'STR-003': 'Túnel_de_vento.jpg',
      wind_tunnel: 'Túnel_de_vento.jpg',
      '4': 'Estrutura_industrial.jpg',
      'STR-004': 'Estrutura_industrial.jpg',
      industrial_structure: 'Estrutura_industrial.jpg',
      '5': 'Fabrica.jpg',
      'STR-005': 'Fabrica.jpg',
      factory: 'Fabrica.jpg',
      '6': 'Centro_de_operações.jpg',
      'STR-006': 'Centro_de_operações.jpg',
      operations_center: 'Centro_de_operações.jpg',
      '7': 'Centro_de_Pit_stop.jpg',
      'STR-007': 'Centro_de_Pit_stop.jpg',
      pit_stop_center: 'Centro_de_Pit_stop.jpg',
      '8': 'Simulador.jpg',
      'STR-008': 'Simulador.jpg',
      simulator: 'Simulador.jpg',
      '9': 'Academia_de_pilotos.jpg',
      'STR-009': 'Academia_de_pilotos.jpg',
      driver_academy: 'Academia_de_pilotos.jpg',
      // Componentes de P&D / carro presentes na pasta estruturas/
      front_wing: 'Asa_Dianteira.jpg',
      rear_wing: 'Asa_Traseira.jpg',
      floor: 'Assoalho.jpg',
      sidepods: 'Laterais.jpg',
      engine: 'Motor.jpg',
      suspension: 'suspensão.jpg',
    }
    const key = String(idOrIndexOrCode)
    const file = structureMap[key] || structureMap[key.replace(/^0+/, '')] || 'Fabrica.jpg'
    return asset(`estruturas/${file}`)
  },
  manager: (fileName: string) => {
    // Correção automática para nome do arquivo real no repositório
    const sanitized = fileName === '01-Estrategista(1).jpg' ? '01-Estrategista.jpg' : fileName
    return asset(`manager/${sanitized}`)
  },
  placeholder: (text = 'APEX') =>
    `https://img.usecurling.com/p/640/360?q=${encodeURIComponent(text)}`,
} as const

export type AssetRegistry = typeof assets
