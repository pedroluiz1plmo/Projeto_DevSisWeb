export class Nota {
  public idNota: string;
  public titulo: string;
  public conteudo: string;
  public dataCriacao: string;

  constructor(titulo: string, conteudo: string, dataCriacao?: string, idNota?: string) {
    this.idNota = idNota || crypto.randomUUID();
    this.titulo = titulo.trim() || 'Sem Título';
    this.conteudo = conteudo.trim();
    this.dataCriacao = dataCriacao || new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

