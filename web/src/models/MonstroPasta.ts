export interface MonstroPasta {
  id: string;
  nome: string;
  tipo: 'pasta' | 'ficha';
  sistema: 'D&D';
  descricao: string;
  parentId: string | null;
  dataCriacao: string;
  dados?: Record<string, string | number>;
}
