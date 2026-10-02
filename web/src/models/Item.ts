export class Item {
  public idItem: string;
  public nomeItem: string;
  public pesoItem: number; // Peso unitário em kg ou lbs
  public quantidade: number;

  constructor(nomeItem: string, pesoItem: number, quantidade: number = 1, idItem?: string) {
    this.idItem = idItem || crypto.randomUUID();
    this.nomeItem = nomeItem;
    this.pesoItem = Math.max(0, pesoItem);
    this.quantidade = Math.max(1, quantidade);
  }

  public getPesoTotal(): number {
    return Number((this.pesoItem * this.quantidade).toFixed(2));
  }
}
