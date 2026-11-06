export class Nota {
  public idNota: string;
  public titulo: string;
  public conteudo: string;
  public dataCriacao: string;
  public backendId: string | null;
  public pastaId: string | null;
  public campanhaId: string | null;
  public pendingSync: boolean;

  constructor(
    titulo: string,
    conteudo: string,
    dataCriacao?: string,
    idNota?: string,
    backendId: string | null = null,
    pastaId: string | null = null,
    campanhaId: string | null = null,
    pendingSync = false
  ) {
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
    this.backendId = backendId;
    this.pastaId = pastaId;
    this.campanhaId = campanhaId;
    this.pendingSync = pendingSync;
  }
}
