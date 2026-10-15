import { assets } from '@/lib/assets'

export interface Circuit {
  id: string
  nome: string
  pais: string
  codigoPais: string
  extensaoKm: number
  voltas: number
  tipo: string
  imagem: string
}

export interface Team {
  id: string
  nome: string
  codigo: string
  pais: string
  corPrimaria: string
  corSecundaria: string
  imagem: string
  emblema: string
}

export interface Driver {
  id: string
  nome: string
  pais: string
  equipe: string
  overall: number
  ritmo: number
  consistencia: number
  ultrapassagem: number
  imagem: string
}

export interface Engine {
  id: string
  nome: string
  pais: string
  potencia: number
  confiabilidade: number
  eficiencia: number
  potencial: number
  custo: 'Baixo' | 'Médio' | 'Alto'
  imagem: string
}

export interface Structure {
  id: string
  nome: string
  nivel: number
  efeito: string
  imagem: string
}

const circuitNames = [
  ['Albert Park', 'Austrália', 'AU', 5.278, 58, 'Rua'],
  ['Xangai', 'China', 'CN', 5.451, 56, 'Pista'],
  ['Suzuka', 'Japão', 'JP', 5.807, 53, 'Pista'],
  ['Sakhir', 'Bahrein', 'BH', 5.412, 57, 'Pista'],
  ['Jeddah Corniche', 'Arábia Saudita', 'SA', 6.174, 50, 'Rua'],
  ['Miami', 'Estados Unidos', 'US', 5.412, 57, 'Rua'],
  ['Ímola', 'Itália', 'IT', 4.909, 63, 'Pista'],
  ['Mônaco', 'Mônaco', 'MC', 3.337, 78, 'Rua'],
  ['Catalunha', 'Espanha', 'ES', 4.657, 66, 'Pista'],
  ['Montreal', 'Canadá', 'CA', 4.361, 70, 'Rua'],
  ['Red Bull Ring', 'Áustria', 'AT', 4.318, 71, 'Pista'],
  ['Silverstone', 'Reino Unido', 'GB', 5.891, 52, 'Pista'],
  ['Spa-Francorchamps', 'Bélgica', 'BE', 7.004, 44, 'Pista'],
  ['Hungaroring', 'Hungria', 'HU', 4.381, 70, 'Pista'],
  ['Zandvoort', 'Países Baixos', 'NL', 4.259, 72, 'Pista'],
  ['Monza', 'Itália', 'IT', 5.793, 53, 'Pista'],
  ['Baku', 'Azerbaijão', 'AZ', 6.003, 51, 'Rua'],
  ['Marina Bay', 'Singapura', 'SG', 4.94, 62, 'Rua'],
  ['Austin', 'Estados Unidos', 'US', 5.513, 56, 'Pista'],
  ['Hermanos Rodríguez', 'México', 'MX', 4.304, 71, 'Pista'],
  ['Interlagos', 'Brasil', 'BR', 4.309, 71, 'Pista'],
  ['Las Vegas', 'Estados Unidos', 'US', 6.201, 50, 'Rua'],
  ['Lusail', 'Catar', 'QA', 5.419, 57, 'Pista'],
  ['Yas Marina', 'Emirados Árabes', 'AE', 5.281, 58, 'Pista'],
  ['Sepang', 'Malásia', 'MY', 5.543, 56, 'Pista'],
  ['Hockenheim', 'Alemanha', 'DE', 4.574, 67, 'Pista'],
  ['Nürburgring', 'Alemanha', 'DE', 5.148, 60, 'Pista'],
  ['Istanbul Park', 'Turquia', 'TR', 5.338, 58, 'Pista'],
  ['Paul Ricard', 'França', 'FR', 5.842, 53, 'Pista'],
  ['Estoril', 'Portugal', 'PT', 4.182, 71, 'Pista'],
  ['Kyalami', 'África do Sul', 'ZA', 4.529, 68, 'Pista'],
  ['Buenos Aires', 'Argentina', 'AR', 4.259, 72, 'Pista'],
  ['Indianápolis', 'Estados Unidos', 'US', 4.192, 73, 'Pista'],
  ['Adelaide', 'Austrália', 'AU', 3.78, 81, 'Rua'],
  ['Fuji', 'Japão', 'JP', 4.563, 67, 'Pista'],
  ['Buddh', 'Índia', 'IN', 5.125, 60, 'Pista'],
  ['Yeongam', 'Coreia do Sul', 'KR', 5.615, 55, 'Pista'],
  ['Valência', 'Espanha', 'ES', 5.419, 57, 'Rua'],
  ['Magny-Cours', 'França', 'FR', 4.411, 70, 'Pista'],
  ['Jerez', 'Espanha', 'ES', 4.428, 69, 'Pista'],
  ['Brands Hatch', 'Reino Unido', 'GB', 3.908, 78, 'Pista'],
  ['Donington Park', 'Reino Unido', 'GB', 4.02, 76, 'Pista'],
  ['Jacarepaguá', 'Brasil', 'BR', 5.031, 61, 'Pista'],
] as const

export const circuits: Circuit[] = circuitNames.map((c, index) => ({
  id: `track_${String(index + 1).padStart(2, '0')}`,
  nome: c[0],
  pais: c[1],
  codigoPais: c[2],
  extensaoKm: c[3],
  voltas: c[4],
  tipo: c[5],
  imagem: assets.circuit(index + 1),
}))

const teamRows = [
  ['Mercedes', 'MER', 'Alemanha', '#121A20', '#15C6BF', 19],
  ['McLaren', 'MCL', 'Reino Unido', '#FF8500', '#121419', 18],
  ['Ferrari', 'FER', 'Itália', '#D51A24', '#F4F4F3', 11],
  ['Red Bull Racing', 'RBR', 'Áustria', '#14254A', '#E42A30', 23],
  ['Aston Martin', 'AMR', 'Reino Unido', '#075246', '#C4D531', 5],
  ['Audi', 'AUD', 'Alemanha', '#D4D6D8', '#D82932', 6],
  ['Williams', 'WIL', 'Reino Unido', '#17469D', '#F4F5F8', 28],
  ['Racing Bulls', 'RBU', 'Itália', '#F3F3F4', '#183B9A', 22],
  ['Haas', 'HAA', 'Estados Unidos', '#F3F4F5', '#D62232', 13],
  ['Alpine', 'ALP', 'França', '#1574C8', '#E879BD', 3],
  ['Cadillac', 'CAD', 'Estados Unidos', '#EEEFF1', '#1C1F25', 9],
  ['Porsche', 'POR', 'Alemanha', '#F0F1F3', '#CF242D', 21],
  ['Honda', 'HON', 'Japão', '#ECEDEE', '#CE1D29', 14],
  ['Lamborghini', 'LAM', 'Itália', '#111318', '#E7BC12', 16],
  ['Andretti', 'AND', 'Estados Unidos', '#F3F4F7', '#1B3763', 4],
  ['BYD', 'BYD', 'China', '#F1F2F4', '#D72533', 8],
  ['Penske', 'PEN', 'Estados Unidos', '#F3F3F4', '#CE2734', 20],
  ['Lotus', 'LOT', 'Reino Unido', '#171717', '#C9A45A', 17],
  ['Toyota', 'TOY', 'Japão', '#F5F5F5', '#E52230', 27],
  ['Benetton', 'BEN', 'Itália', '#E8CD31', '#0A8A58', 7],
  ['Copersucar', 'COP', 'Brasil', '#F2F3F4', '#185790', 10],
  ['Alfa Romeo', 'ALF', 'Itália', '#8C1831', '#F2F2F2', 1],
  ['AlphaTauri', 'ATU', 'Itália', '#17233B', '#F1F3F7', 2],
  ['Fittipaldi', 'FIT', 'Brasil', '#E1B822', '#171718', 12],
  ['Jordan', 'JOR', 'Irlanda', '#0D7448', '#E6C611', 15],
  ['Renault', 'REN', 'França', '#E8BB10', '#181818', 24],
  ['Sauber', 'SAU', 'Suíça', '#25CF37', '#121714', 25],
  ['Toleman', 'TOL', 'Reino Unido', '#F1F2F4', '#192B4C', 26],
  ['Gurgel Racing', 'GUR', 'Brasil', '#E8770A', '#191C1F', 29],
  ['Hotwells GP', 'HOT', 'Estados Unidos', '#8E1FCA', '#111219', 30],
  ['De Tomaso Corse', 'DTC', 'Itália', '#E52632', '#1D1C21', 31],
  ['Lotec Racing', 'LTC', 'Alemanha', '#0E5744', '#D5B14B', 32],
  ['Venturi Motorsport', 'VEN', 'Mônaco', '#1D63D5', '#151924', 33],
] as const

export const teams: Team[] = teamRows.map((t, index) => ({
  id: `team_${String(index + 1).padStart(4, '0')}`,
  nome: t[0],
  codigo: t[1],
  pais: t[2],
  corPrimaria: t[3],
  corSecundaria: t[4],
  imagem: assets.team(t[5]),
  emblema: assets.emblem(t[5]),
}))

const firstNames = [
  'Arthur',
  'Miguel',
  'Lucas',
  'Enzo',
  'Gabriel',
  'Leonardo',
  'Rafael',
  'Matteo',
  'Liam',
  'Oliver',
  'Theo',
  'Nico',
]
const lastNames = [
  'Silva',
  'Martins',
  'Rossi',
  'Moreau',
  'Weber',
  'Müller',
  'Costa',
  'Bianchi',
  'Walker',
  'Sato',
  'Almeida',
  'Vargas',
  'Brown',
  'López',
  'Kowalski',
  'Tanaka',
]
export const drivers: Driver[] = Array.from({ length: 188 }, (_, index) => ({
  id: `pil_${String(index + 1).padStart(4, '0')}`,
  nome: `${firstNames[index % firstNames.length]} ${lastNames[(index * 7) % lastNames.length]}`,
  pais: circuits[index % circuits.length].pais,
  equipe: teams[index % teams.length].nome,
  overall: 58 + ((index * 11) % 38),
  ritmo: 55 + ((index * 13) % 43),
  consistencia: 52 + ((index * 17) % 46),
  ultrapassagem: 54 + ((index * 19) % 44),
  imagem: assets.driver(index + 1),
}))

const engineRows = [
  ['Audi', 'Alemanha', 84, 80, 82, 88, 'Médio'],
  ['Ferrari', 'Itália', 89, 77, 79, 85, 'Alto'],
  ['Ford', 'Estados Unidos', 80, 74, 78, 79, 'Baixo'],
  ['Honda', 'Japão', 88, 76, 81, 90, 'Médio'],
  ['Mercedes', 'Alemanha', 86, 88, 87, 82, 'Alto'],
  ['Renault', 'França', 83, 81, 82, 84, 'Médio'],
  ['Toyota', 'Japão', 85, 86, 85, 86, 'Alto'],
  ['Porsche', 'Alemanha', 87, 85, 84, 89, 'Alto'],
  ['BMW', 'Alemanha', 86, 83, 81, 85, 'Alto'],
  ['Lamborghini', 'Itália', 88, 72, 77, 92, 'Alto'],
  ['Peugeot', 'França', 81, 78, 80, 83, 'Baixo'],
] as const
export const engines: Engine[] = engineRows.map((e, index) => ({
  id: `ENG-${String(index + 1).padStart(4, '0')}`,
  nome: e[0],
  pais: e[1],
  potencia: e[2],
  confiabilidade: e[3],
  eficiencia: e[4],
  potencial: e[5],
  custo: e[6],
  imagem: assets.engine(index + 1),
}))

const structureRows = [
  ['Túnel de vento', 'Eleva o desenvolvimento aerodinâmico'],
  ['Fábrica', 'Acelera a produção de atualizações'],
  ['Centro de P&D', 'Amplia o potencial de desenvolvimento'],
  ['Simulador', 'Melhora a preparação dos pilotos'],
  ['Centro de estratégia', 'Otimiza decisões de corrida'],
  ['Academia de pilotos', 'Desenvolve jovens talentos'],
  ['Centro médico', 'Reduz fadiga e tempo de recuperação'],
  ['Departamento comercial', 'Amplia receitas e oportunidades'],
]
export const structures: Structure[] = structureRows.map((s, index) => ({
  id: `STR-${String(index + 1).padStart(3, '0')}`,
  nome: s[0],
  nivel: (index % 5) + 1,
  efeito: s[1],
  imagem: assets.structure(index + 1),
}))
