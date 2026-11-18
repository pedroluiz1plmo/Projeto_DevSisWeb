export interface MonstroPasta {
  id: string;
  nome: string;
  tipo: 'pasta' | 'ficha';
  sistema: string;
  descricao: string;
  parentId: string | null;
  dataCriacao: string;
  dados?: Record<string, unknown>;
  backendIdsByCampaign?: Record<string, {
    id: string;
    systemId: string;
    systemVersionId: string;
  }>;
}
