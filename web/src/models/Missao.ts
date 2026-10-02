export type StatusMissao = 'em_progresso' | 'concluida';

export class Missao {
  public idMissao: string;
  public titulo: string;
  public descricao: string;
  public recompensa: string;
  public status: StatusMissao;
  public dataCriacao: string;

  constructor(
    titulo: string,
    descricao: string,
    recompensa: string = '',
    status: StatusMissao = 'em_progresso',
    dataCriacao?: string,
    idMissao?: string
  ) {
    this.idMissao = idMissao || crypto.randomUUID();
    this.titulo = titulo.trim() || 'Nova Missão';
    this.descricao = descricao.trim();
    this.recompensa = recompensa.trim();
    this.status = status;
    this.dataCriacao = dataCriacao || new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  public toggleStatus(): void {
    this.status = this.status === 'em_progresso' ? 'concluida' : 'em_progresso';
  }
}

