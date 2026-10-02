import { Usuario } from './Usuario';
import { Personagem } from './Personagem';

export class Jogador extends Usuario {
  public personagens: Personagem[];

  constructor(idUsuario: string, nome: string, email: string, personagens: Personagem[] = []) {
    super(idUsuario, nome, email);
    this.personagens = personagens;
  }

  public gerenciarPersonagens(): Personagem[] {
    return this.personagens;
  }

  public adicionarPersonagem(personagem: Personagem): void {
    this.personagens.push(personagem);
  }

  public removerPersonagem(idPersonagem: string): boolean {
    const index = this.personagens.findIndex(p => p.idPersonagem === idPersonagem);
    if (index !== -1) {
      this.personagens.splice(index, 1);
      return true;
    }
    return false;
  }

  public obterPersonagem(idPersonagem: string): Personagem | undefined {
    return this.personagens.find(p => p.idPersonagem === idPersonagem);
  }
}
