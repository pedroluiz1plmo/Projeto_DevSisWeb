export interface SistemaPasta {
  id: string;
  nome: string;
  valor: string;
  icone: string;
  descricao: string;
  subpastas: SistemaPasta[];
}
