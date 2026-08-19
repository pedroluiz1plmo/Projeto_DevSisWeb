# RPG HUB - Sistema de Gerenciamento de Fichas de RPG

Projeto desenvolvido para a disciplina de **Engenharia de Software** do curso de **Bacharelado em Ciências da Computação** da **UNEMAT (Universidade do Estado de Mato Grosso)**.

- **Docente:** Profª. Maricy Caregnato
- **Discentes:** Danny Anny Terezinha Scholze e Pedro Luiz Mateus de Oliveira

---

## 🎯 Sobre o Projeto

O **RPG HUB** é uma aplicação web moderna focada na experiência do usuário (UX) e na redução de carga cognitiva para jogadores e mestres de RPG de Mesa (adotando a metodologia ágil **b_thinking**). O sistema integra regras, cálculos automáticos em tempo real, fichas dinâmicas, controle de inventário e combate tático.

---

## 🚀 Tecnologias Utilizadas

- **HTML5 & CSS3 Vanilla:** Design moderno Dark Glassmorphism, responsividade e animações fluídas sem frameworks pesados.
- **TypeScript:** Tipagem estática rigorosa e implementação orientada a objetos (POO) aderente ao diagrama de classes UML.
- **Vite:** Ferramenta de build ultrarrápida e servidor de desenvolvimento.
- **Mermaid.js:** Renderização dinâmica dos diagramas UML (Classes, Atividades, Sequência e Casos de Uso) diretamente no navegador.
- **Web Crypto API:** Geração de aleatoriedade criptográfica (`crypto.getRandomValues`) para rolagens de dados justas e precisas.

---

## 📋 Casos de Uso Implementados

* **UC01 - Manter Personagem:** Consulta, edição contínua de PV, Mana, CA, XP e subida de nível em tempo real.
* **UC02 - Criar Personagem Guiado (Wizard):** Assistente passo a passo que valida a distribuição de atributos (faixa de 8 a 18) e calcula automaticamente Modificadores, Pontos de Vida (PV) e Classe de Armadura (CA).
* **UC03 - Gerenciar Inventário:** Cálculo automático de peso total vs. limite de carga máxima da Força (`Força * 7 kg`), com alerta visual instantâneo de **"Sobrecarregado"**.
* **UC04 - Gerenciar Magias e Habilidades:** Cadastro e consulta de feitiços arcanos, custos de recursos e efeitos.
* **UC05 - Realizar Rolagem de Dados:** Rolagens de `1d20 + Modificador` com detecção de Acertos Críticos (20) e Falhas Críticas (1), além de histórico de sessão.
* **UC06 - Manter Campanhas:** Organização do grupo de jogadores, lore e repositório narrativo da mesa pelo Mestre.
* **UC07 - Manter NPCs e Criaturas:** Fichas simplificadas de monstros e ameaças com controle de PV em tempo real.
* **UC08 - Gerenciar Iniciativa:** Painel tático que insere combatentes, rola iniciativa e ordena automaticamente a ordem de turnos do combate.
* **Hub UML Interativo:** Visualização em alta definição de todos os diagramas da modelagem do sistema.

---

## 🛠️ Como Executar o Projeto Localmente

### Pré-requisitos
* [Node.js](https://nodejs.org/) (versão 18 ou superior)
* [Git](https://git-scm.com/)

### Passos:
```bash
# 1. Clonar o repositório
git clone https://github.com/pedroluiz1plmo/Projeto_DevSisWeb.git

# 2. Acessar a pasta do projeto
cd Projeto_DevSisWeb

# 3. Instalar as dependências
npm install

# 4. Iniciar o servidor de desenvolvimento
npm run dev

# 5. Acessar no navegador:
# http://localhost:5173/
```

### Para gerar o bundle de produção:
```bash
npm run build
npm run preview
```
