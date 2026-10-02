export interface SistemaInventarioItem {
  id: string;
  nome: string;
  quantidade: number;
  peso: number;
  descricao: string;
}

export interface SistemaPasta {
  id: string;
  nome: string;
  tipo: 'pasta' | 'ficha';
  sistema: string;
  descricao: string;
  parentId: string | null;
  dataCriacao: string;
  dados?: Record<string, string | number>;
  inventario?: SistemaInventarioItem[];
}
