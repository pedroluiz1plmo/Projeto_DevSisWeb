export type UserRole = 'jogador' | 'mestre';

export class RoleSelectionModal {
  public static render(guest = false): string {
    return `
      <div id="role-selection-modal" class="modal-backdrop role-selection-backdrop" role="dialog" aria-modal="true" aria-labelledby="role-selection-title">
        <section class="modal-content glass-card role-selection-modal">
          <div class="role-selection-symbol" aria-hidden="true">⚔️</div>
          <h2 id="role-selection-title">${guest ? 'Escolha um painel para experimentar' : 'Qual é o seu papel na aventura?'}</h2>
          <p>${guest
            ? 'No modo visitante, seus dados ficam apenas neste dispositivo. Amizades, Meu Plano e participação em campanhas de outras pessoas exigem uma conta.'
            : 'Escolha a visão que deseja utilizar. Você poderá alterar essa escolha a qualquer momento.'}</p>
          <div class="role-options">
            <button type="button" class="role-option role-option-player" data-role="jogador">
              <span class="role-option-icon" aria-hidden="true">🎲</span>
              <span class="role-option-content"><strong>Jogador</strong><small>Gerencie fichas, inventário e rolagens.</small></span>
              <span class="role-option-arrow" aria-hidden="true">→</span>
            </button>
            <button type="button" class="role-option role-option-gm" data-role="mestre">
              <span class="role-option-icon" aria-hidden="true">👑</span>
              <span class="role-option-content"><strong>Mestre</strong><small>Conduza campanhas, monstros e combates.</small></span>
              <span class="role-option-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </div>
    `;
  }
}
