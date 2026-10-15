const asset = (path: string) =>
  `https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

export const assets = {
  branding: {
    cover: asset('logo_base_programa/Capa.jpg'),
    background: asset('logo_base_programa/fundo01.jpg'),
    logo: asset('logo_base_programa/Logo APEX GP Manager 2.0.png'),
    logoTransparent: asset('logo_base_programa/Logo APEX GP Manager 2.0-transparente.png'),
    logoReduced: asset('logo_reduzida/Logo reduzida APEX GP Manager 2.0.png'),
  },
  circuit: (index: number) =>
    asset(`APEX2_circuitos_43/track_${String(index).padStart(2, '0')}.svg`),
  team: (index: number) => asset(`equipes/equipe_${String(index).padStart(4, '0')}.jpg`),
  emblem: (index: number) => asset(`emblemas/emblema_${String(index).padStart(4, '0')}.png`),
  driver: (index: number) => asset(`pilotos/DRV_${String(index).padStart(4, '0')}.jpg`),
  engine: (index: number) => asset(`motores/motor_${String(index).padStart(3, '0')}.jpg`),
  structure: (index: number) => asset(`estruturas/estrutura_${String(index).padStart(2, '0')}.jpg`),
  manager: (fileName: string) => asset(`manager/${fileName}`),
} as const

export type AssetRegistry = typeof assets
