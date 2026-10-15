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
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`APEX2_circuitos_43/track_${num.padStart(2, '0')}.svg`)
  },
  team: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`equipes/equipe_${num.padStart(4, '0')}.jpg`)
  },
  emblem: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`emblemas/emblema_${num.padStart(4, '0')}.png`)
  },
  driver: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`pilotos/DRV_${num.padStart(4, '0')}.jpg`)
  },
  engine: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`motores/motor_${num.padStart(3, '0')}.jpg`)
  },
  structure: (index: number | string) => {
    const num = typeof index === 'string' ? index.replace(/\D/g, '') : String(index)
    return asset(`estruturas/estrutura_${num.padStart(2, '0')}.jpg`)
  },
  manager: (fileName: string) => asset(`manager/${fileName}`),
} as const

export type AssetRegistry = typeof assets
