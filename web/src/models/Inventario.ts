import { Item } from './Item';

export class Inventario {
  public itens: Item[];
  public limiteCarga: number;

  constructor(limiteCarga: number = 70, itens: Item[] = []) {
    this.limiteCarga = Math.max(0, limiteCarga);
    this.itens = itens;
  }

  public get pesoTotal(): number {
    const total = this.itens.reduce((acc, item) => acc + item.getPesoTotal(), 0);
    return Number(total.toFixed(2));
  }

  public adicionarItem(item: Item): void {
    const itemExistente = this.itens.find(i => i.nomeItem.toLowerCase() === item.nomeItem.toLowerCase() && i.pesoItem === item.pesoItem);
    if (itemExistente) {
      itemExistente.quantidade += item.quantidade;
    } else {
      this.itens.push(item);
    }
  }

  public removerItem(idItem: string): boolean {
    const index = this.itens.findIndex(i => i.idItem === idItem);
    if (index !== -1) {
      this.itens.splice(index, 1);
      return true;
    }
    return false;
  }

  public estaSobrecarregado(): boolean {
    return this.pesoTotal > this.limiteCarga;
  }
}
