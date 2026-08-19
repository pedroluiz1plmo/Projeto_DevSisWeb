import mermaid from 'mermaid';

export class UmlView {
  public static render(): string {
    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3 style="color: #34d399;">📐 Modelagem UML Interativa do Sistema</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Renderização dinâmica dos diagramas estruturais e comportamentais da disciplina de Engenharia de Software (UNEMAT)
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-switch-uml active" data-diagram="classes">1. Diagrama de Classes</button>
            <button class="btn btn-secondary btn-switch-uml" data-diagram="atividades">2. Atividades (UC02)</button>
            <button class="btn btn-secondary btn-switch-uml" data-diagram="sequencia">3. Sequência (UC05)</button>
            <button class="btn btn-secondary btn-switch-uml" data-diagram="casosuso">4. Casos de Uso Geral</button>
          </div>
        </div>

        <div id="uml-diagram-display" class="uml-container">
          <!-- Dynamic Mermaid Diagram -->
        </div>

        <!-- Explicação do Diagrama -->
        <div id="uml-explanation" style="margin-top: 20px; padding: 16px; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
          <!-- Explanation injected dynamically -->
        </div>
      </div>
    `;
  }

  public static async renderDiagram(diagramType: 'classes' | 'atividades' | 'sequencia' | 'casosuso'): Promise<void> {
    const container = document.getElementById('uml-diagram-display');
    const explanation = document.getElementById('uml-explanation');
    if (!container || !explanation) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0d121f',
        primaryColor: '#6366f1',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#818cf8',
        lineColor: '#94a3b8',
        secondaryColor: '#f43f5e',
        tertiaryColor: '#10b981'
      }
    });

    let code = '';
    let explHtml = '';

    if (diagramType === 'classes') {
      code = `
classDiagram
    direction TB
    class Usuario {
        <<Abstract>>
        +UUID idUsuario
        +String nome
        +String email
    }
    class Jogador {
        +gerenciarPersonagens()
    }
    class Mestre {
        +gerenciarCampanhas()
        +gerenciarNPCs()
        +gerenciarIniciativa()
    }
    class Personagem {
        +String nomePersonagem
        +String classe
        +String raca
        +Integer nivel
        +Integer pontosVida
        +Integer XP
        +calcularModificadores()
        +atualizarVida()
        +subirNivel()
    }
    class Inventario {
        +Float pesoTotal
        +Float limiteCarga
        +adicionarItem()
        +removerItem()
    }
    class Item {
        +String nomeItem
        +Float pesoItem
        +Integer quantidade
        +getPesoTotal()
    }
    class MagiaHabilidade {
        +String nome
        +Integer custoMana
        +String tempoConjuracao
        +String efeito
    }
    class Campanha {
        +String nomeCampanha
        +String lore
        +Date dataCriacao
    }
    class NPC {
        +String nivelDesafio
        +Integer vida
        +String ataques
    }

    Usuario <|-- Jogador
    Usuario <|-- Mestre
    Jogador "1" --> "1..*" Personagem : gerencia
    Mestre "1" --> "0..*" Campanha : gerencia
    Campanha "1" o-- "1..*" Personagem : agrega
    Campanha "1" o-- "0..*" NPC : agrega
    Personagem "1" *-- "1" Inventario : composição
    Inventario "1" *-- "0..*" Item : contém
    Personagem "1" --> "0..*" MagiaHabilidade : conhece
      `;
      explHtml = `
        <h4 style="color: #818cf8; margin-bottom: 6px;">📐 Sobre o Diagrama de Classes</h4>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6;">
          Modela as entidades fundamentais do sistema. A classe abstrata <strong>Usuario</strong> é herdada por <strong>Jogador</strong> e <strong>Mestre</strong>. 
          O <strong>Personagem</strong> possui composição estrita (1 para 1) com seu <strong>Inventario</strong>, e o <strong>Mestre</strong> agrega personagens e NPCs em suas <strong>Campanhas</strong>.
        </p>
      `;
    } else if (diagramType === 'atividades') {
      code = `
stateDiagram-v2
    [*] --> JogadorSolicita : Início
    JogadorSolicita --> SelecionarSistema : Jogador solicita novo personagem
    SelecionarSistema --> SistemaApresenta : Selecionar sistema de RPG (D&D, Tormenta)
    SistemaApresenta --> EscolherRacaClasse : Sistema apresenta raças e classes
    EscolherRacaClasse --> SistemaAplicaBonus : Jogador escolhe raça e classe
    SistemaAplicaBonus --> InformarAtributos : Sistema aplica bônus iniciais
    InformarAtributos --> ValidarAtributos : Jogador informa atributos base
    
    state ValidarAtributos <<choice>>
    ValidarAtributos --> SistemaExibeErro : Não (Atributos Inválidos)
    SistemaExibeErro --> InformarAtributos : Corrigir atributos
    
    ValidarAtributos --> SistemaCalcula : Sim (Válidos)
    SistemaCalcula --> ConfirmarDados : Calcula Modificadores, PV e CA
    ConfirmarDados --> SalvarFicha : Confirmar dados
    SalvarFicha --> FichaDisponivel : Salvar ficha
    FichaDisponivel --> [*] : Fim (Ficha pronta no dashboard)
      `;
      explHtml = `
        <h4 style="color: #818cf8; margin-bottom: 6px;">✨ Sobre o Diagrama de Atividades (UC02 - Criação Guiada)</h4>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6;">
          Ilustra o fluxo de navegação do assistente de criação. A validação de limites dos atributos impede que valores fora do padrão desequilibrem o jogo, retornando ao estado de correção antes de disparar os cálculos automáticos de PV e CA.
        </p>
      `;
    } else if (diagramType === 'sequencia') {
      code = `
sequenceDiagram
    autonumber
    actor Jogador as Jogador (Ator)
    participant Interface as InterfaceFicha (Fronteira)
    participant Personagem as Personagem (Entidade)
    participant Controle as ControladorRegras (Controle)
    participant Calculadora as DiceService / Cripto (Controle)

    Jogador->>Interface: solicitarRolagem(pericia/atributo)
    Interface->>Personagem: obterModificador(pericia)
    Personagem-->>Interface: valorModificador
    Interface->>Controle: executarSorteio(1d20, modificador)
    Controle->>Calculadora: crypto.getRandomValues()
    Calculadora-->>Controle: numeroAleatorio (1 a 20)
    Controle-->>Interface: resultadoFinal (Total, Crítico/Falha)
    Interface-->>Jogador: exibirResultado com destaque visual
      `;
      explHtml = `
        <h4 style="color: #818cf8; margin-bottom: 6px;">🎯 Sobre o Diagrama de Sequência (UC05 - Rolagem de Dados)</h4>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6;">
          Demonstra o desacoplamento de responsabilidades: a interface solicita o modificador do personagem, repassa para o controlador de regras, que utiliza o algoritmo criptográfico de números aleatórios e devolve o resultado com destaque para acertos críticos (20) ou falhas críticas (1).
        </p>
      `;
    } else {
      code = `
graph LR
    subgraph SistemaRPG["Sistema de Gerenciamento de Fichas de RPG"]
        UC02["UC02 - Criar Personagem Guiado"]
        UC01["UC01 - Manter Personagem"]
        UC03["UC03 - Gerenciar Inventário"]
        UC04["UC04 - Gerenciar Magias e Habilidades"]
        UC10["UC10 - Emitir Histórico de Evolução"]
        UC05["UC05 - Realizar Rolagem de Dados"]
        UC06["UC06 - Manter Campanha"]
        UC09["UC09 - Customizar Sistema de RPG"]
        UC08["UC08 - Gerenciar Iniciativa"]
        UC07["UC07 - Manter NPCs e Criaturas"]
    end

    Jogador((Jogador))
    Mestre((Mestre))

    Jogador --> UC02
    Jogador --> UC01
    Jogador --> UC03
    Jogador --> UC04
    Jogador --> UC10
    Jogador --> UC05

    Mestre --> UC01
    Mestre --> UC03
    Mestre --> UC05
    Mestre --> UC06
    Mestre --> UC09
    Mestre --> UC08
    Mestre --> UC07
      `;
      explHtml = `
        <h4 style="color: #818cf8; margin-bottom: 6px;">📋 Sobre o Diagrama Geral de Casos de Uso</h4>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6;">
          Mapeia a interação dos atores <strong>Jogador</strong> e <strong>Mestre (GM)</strong> com as 10 funcionalidades essenciais da plataforma, demonstrando claramente a divisão de escopo entre a experiência narrativa do jogador e o gerenciamento tático do mestre.
        </p>
      `;
    }

    try {
      const id = 'mermaid-svg-' + Date.now();
      const { svg } = await mermaid.render(id, code);
      container.innerHTML = svg;
      explanation.innerHTML = explHtml;
    } catch (e) {
      console.error('Erro ao renderizar Mermaid:', e);
      container.innerHTML = `<p style="color: var(--danger);">Erro ao renderizar diagrama UML: ${e}</p>`;
    }
  }
}
