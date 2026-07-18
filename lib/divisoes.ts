export type Divisao = {
  label: string;
  opcoes: string[];
};

export const DIVISOES: Record<string, Divisao> = {
  cozinha: { label: 'Cozinha', opcoes: ['Pintura', 'Revestimentos', 'Móveis novos', 'Bancada', 'Canalização', 'Eletricidade'] },
  casa_banho: { label: 'Casa de Banho', opcoes: ['Pintura', 'Revestimentos', 'Sanitários', 'Móveis suspensos', 'Canalização', 'Eletricidade'] },
  sala: { label: 'Sala', opcoes: ['Pintura', 'Pavimento', 'Teto falso', 'Iluminação'] },
  quarto: { label: 'Quarto', opcoes: ['Pintura', 'Pavimento', 'Roupeiro embutido', 'Iluminação'] },
  hall_corredor: { label: 'Hall / Corredor', opcoes: ['Pintura', 'Pavimento', 'Iluminação'] },
  exterior_jardim: { label: 'Exterior / Jardim', opcoes: ['Mobiliário de jardim', 'Ripados', 'Pavimento exterior', 'Rega/Drenagem', 'Iluminação exterior'] },
  terraco_varanda: { label: 'Terraço / Varanda', opcoes: ['Pavimento', 'Guarda-corpos', 'Cobertura', 'Ripados'] },
  garagem: { label: 'Garagem', opcoes: ['Pintura', 'Pavimento', 'Portão automático', 'Arrumação'] },
  fachada: { label: 'Fachada', opcoes: ['Pintura exterior', 'Isolamento (ETICS)', 'Caixilharia'] },
};

export const NOMES_DIVISOES = Object.keys(DIVISOES);
