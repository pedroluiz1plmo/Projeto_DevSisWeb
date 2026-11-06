/** Criação guiada de D&D 5e organizada como na ficha de referência. */
export class FichaGuiadaView {
  public static render(): string {
    return `
      <div id="guided-template-dnd" class="guided-template hidden">
        <div id="native-guided-dnd"></div>
      </div>
    `;
  }
}
