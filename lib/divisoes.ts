export type Divisao = {
  label: string;
  opcoes: string[];
};

export const DIVISOES: Record<string, Divisao> = {
  cozinha: {
    label: 'Cozinha',
    opcoes: ['Pintura', 'Revestimentos', 'Desmontar armários existentes', 'Montar armários novos', 'Bancada nova', 'Eletrodomésticos novos', 'Lavandaria integrada', 'Canalização', 'Eletricidade', 'Iluminação'],
  },
  casa_banho: {
    label: 'Casa de Banho',
    opcoes: ['Pintura', 'Revestimentos', 'Substituir sanitários', 'Móveis suspensos novos', 'Duche/banheira nova', 'Canalização', 'Eletricidade', 'Iluminação'],
  },
  lavandaria: {
    label: 'Lavandaria',
    opcoes: ['Pintura', 'Revestimentos', 'Ponto para máquina de lavar/secar', 'Armários de arrumação', 'Canalização', 'Eletricidade'],
  },
  sala: {
    label: 'Sala',
    opcoes: ['Pintura', 'Pavimento novo', 'Teto falso', 'Iluminação', 'Abertura de parede / open space'],
  },
  quarto: {
    label: 'Quarto',
    opcoes: ['Pintura', 'Pavimento novo', 'Roupeiro embutido', 'Iluminação'],
  },
  hall_corredor: {
    label: 'Hall / Corredor',
    opcoes: ['Pintura', 'Pavimento novo', 'Iluminação'],
  },
  exterior_jardim: {
    label: 'Exterior / Jardim',
    opcoes: ['Mobiliário de jardim', 'Ripados', 'Pavimento exterior', 'Rega/Drenagem', 'Iluminação exterior', 'Zona de churrasco/lazer'],
  },
  terraco_varanda: {
    label: 'Terraço / Varanda',
    opcoes: ['Pavimento', 'Guarda-corpos', 'Cobertura', 'Ripados', 'Impermeabilização'],
  },
  garagem: {
    label: 'Garagem',
    opcoes: ['Pintura', 'Pavimento', 'Portão automático', 'Arrumação/Prateleiras'],
  },
  fachada: {
    label: 'Fachada',
    opcoes: ['Pintura exterior', 'Isolamento (ETICS)', 'Caixilharia', 'Impermeabilização'],
  },
};

export const NOMES_DIVISOES = Object.keys(DIVISOES);
