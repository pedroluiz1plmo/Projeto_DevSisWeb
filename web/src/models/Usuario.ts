export abstract class Usuario {
  public idUsuario: string;
  public nome: string;
  public email: string;

  constructor(idUsuario: string, nome: string, email: string) {
    this.idUsuario = idUsuario;
    this.nome = nome;
    this.email = email;
  }
}
