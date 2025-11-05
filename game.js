document.addEventListener("DOMContentLoaded", () => {
  new HexGame();
});

class HexGame {
  //!
  //! INICIALIZAÇÃO
  //!

  constructor() {
    //? --- Configurações do Tabuleiro ---
    this.TAMANHO_HEX = 20; // Raio (tamanho) de cada hexágono em pixels

    this.CORES = {
      AZUL: "#3498db",
      VERMELHO: "#e74c3c",
      VAZIO: "#5d6d7e", // Célula não preenchida
      LINHA: "#bdc3c7", // Linha de contorno do hexágono
    };

    //? --- Constantes dos Jogadores ---
    this.JOGADOR_VAZIO = 0;
    this.JOGADOR_AZUL = 1; // Player 1
    this.JOGADOR_VERMELHO = 2; // Player 2

    //? --- Estado do Jogo (Voláteis) ---
    this.tabuleiroLogico = {}; // O "cérebro" do jogo. Armazena o estado de cada célula (ex: {"2,3": 1})
    this.poligonosHex = []; // Lista para guardar as coordenadas (x,y) de cada hexágono (para cliques)
    this.jogadorAtual = this.JOGADOR_AZUL; // O jogo sempre começa com o Azul
    this.gameOver = false; // Flag que indica se o jogo terminou
    this.isAITurn = false; // Flag que bloqueia cliques humanos durante a vez da IA
    this.TAMANHO_TABULEIRO = 0; // Será inicializado corretamente no reiniciarJogo

    //? --- Elementos do DOM (Interface) ---
    // Captura os elementos do HTML e guarda em variáveis para fácil acesso.
    this.canvas = document.getElementById("hex-canvas");
    this.ctx = this.canvas.getContext("2d"); // O "pincel" para desenhar no canvas
    this.statusLabel = document.getElementById("status-label");

    // Controles
    this.modeSelect = document.getElementById("mode-select");
    this.sizeSelect = document.getElementById("size-select");
    this.algoSelect = document.getElementById("algo-select");
    this.depthSelect = document.getElementById("depth-select");
    this.aiSettingsGroup = document.getElementById("ai-settings-group");
    this.botaoReiniciar = document.getElementById("restart-button");

    //? --- Inicialização ---
    this.criarOuvintes(); // Configura os "ouvintes" de clique e mudança
    this.reiniciarJogo(); // Começa o jogo pela primeira vez
  }

  //! Criação dos ouvintes (listeners)

  // Cria os ouvintes de eventos para interações do usuário
  criarOuvintes() {
    // "Ouvinte" para o dropdown de modo. Quando mudar, chama this.onModoChange
    this.modeSelect.addEventListener("change", () => this.onModoChange());

    // "Ouvinte" para o botão. Quando clicar, chama this.reiniciarJogo
    this.botaoReiniciar.addEventListener("click", () => this.reiniciarJogo());

    // "Ouvinte" para o dropdown de tamanho. Quando mudar, chama this.reiniciarJogo
    this.sizeSelect.addEventListener("change", () => this.reiniciarJogo());

    // "Ouvinte" para cliques no canvas. Quando clicar, chama this.aoClicar
    this.canvas.addEventListener("click", (e) => this.aoClicar(e));
  }

  // Chamado quando o dropdown "Modo de Jogo" é alterado.
  onModoChange() {
    const modo = this.getModoJogo();
    // Esconde ou mostra as configurações da IA (Profundidade, Algoritmo)
    if (modo === "pvp") {
      this.aiSettingsGroup.style.display = "none";
    } else {
      this.aiSettingsGroup.style.display = "flex";
    }
    // Reinicia o jogo para aplicar a mudança de modo.
    this.reiniciarJogo();
  }

  // A função "Reset". Limpa o tabuleiro e começa um novo jogo.
  reiniciarJogo() {
    this.TAMANHO_TABULEIRO = this.getTamanhoTabuleiro();
    this.gameOver = false;
    this.jogadorAtual = this.JOGADOR_AZUL;
    this.tabuleiroLogico = {};
    this.poligonosHex = [];

    const modo = this.getModoJogo();

    // Ajusta a interface (label, inputs) dependendo do modo de jogo.
    if (modo === "pvp") {
      this.aiSettingsGroup.style.display = "none";
      this.isAITurn = false;
      this.setStatus("Vez do Jogador AZUL (Humano)");
    } else {
      this.aiSettingsGroup.style.display = "flex";
      this.isAITurn = false;
      this.setStatus("Vez do Jogador AZUL (Humano)");
    }

    // Calcula o tamanho do canvas e o aplica.
    const { canvasWidth, canvasHeight } = this.calcularTamanhoCanvas();
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    // (Bloco 4) Desenha o tabuleiro limpo (células cinzas).
    this.desenharTabuleiro();
  }

  //! --- Funções "Setters" ---

  // Função auxiliar para atualizar o <h2> de status.
  setStatus(texto) {
    this.statusLabel.textContent = texto;
  }

  //! --- Funções "Getter" ---
  // Funções simples que apenas leem o valor atual dos <select> no HTML.
  getModoJogo() {
    return this.modeSelect.value;
  }

  getAlgoIA() {
    return this.algoSelect.value;
  }

  getProfundidadeIA() {
    return parseInt(this.depthSelect.value);
  }

  getTamanhoTabuleiro() {
    return parseInt(this.sizeSelect.value);
  }

  //!
  //! Renderização
  //!

  // Calcula o tamanho total (em pixels) que o canvas precisa ter
  calcularTamanhoCanvas() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const padding = this.TAMANHO_HEX * 1.5;

    // Loop por todas as células para encontrar as coordenadas extremas (min/max).
    for (let r = 0; r < this.TAMANHO_TABULEIRO; r++) {
      for (let c = 0; c < this.TAMANHO_TABULEIRO; c++) {
        const [x, y] = this.calcularCentroHex(r, c);
        minX = Math.min(minX, x - this.TAMANHO_HEX);
        minY = Math.min(minY, y - this.TAMANHO_HEX);
        maxX = Math.max(maxX, x + this.TAMANHO_HEX);
        maxY = Math.max(maxY, y + this.TAMANHO_HEX);
      }
    }
    // Retorna a largura e altura totais.
    return {
      canvasWidth: maxX - minX + padding,
      canvasHeight: maxY - minY + padding,
    };
  }

  // Desenha o tabuleiro inicial, todo vazio.
  desenharTabuleiro() {
    // Limpa qualquer desenho anterior.
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Loop duplo (linha por linha, coluna por coluna).
    for (let r = 0; r < this.TAMANHO_TABULEIRO; r++) {
      for (let c = 0; c < this.TAMANHO_TABULEIRO; c++) {
        // 1. Define o estado lógico da célula como VAZIO.
        this.tabuleiroLogico[`${r},${c}`] = this.JOGADOR_VAZIO;
        // 2. Desenha o hexágono cinza (VAZIO) na tela.
        this.desenharHex(r, c, this.CORES.VAZIO);
      }
    }
    // 3. Desenha as bordas coloridas (Azul e Vermelho) por cima.
    this.desenharBordas();
  }

  // A função de desenho principal: desenha UM hexágono.
  desenharHex(r, c, corFill) {
    // 1. Converte (linha, coluna) para (x, y) em pixels.
    const [x, y] = this.calcularCentroHex(r, c);
    // 2. Calcula os 6 vértices do hexágono ao redor do centro (x, y).
    const pontos = this.calcularPontosHex(x, y);

    // 3. Salva as coordenadas (x,y) na lista `poligonosHex`
    //    Isso é crucial para o 'findHexClicado' (Bloco 5) funcionar.
    if (!this.poligonosHex.find((p) => p.r === r && p.c === c)) {
      this.poligonosHex.push({ r, c, x, y });
    }

    // 4. Comandos de desenho do Canvas 2D:
    this.ctx.beginPath(); // Começa um novo desenho
    this.ctx.moveTo(pontos[0][0], pontos[0][1]); // Move o "pincel" para o 1º ponto
    for (let i = 1; i < 6; i++) {
      this.ctx.lineTo(pontos[i][0], pontos[i][1]); // Desenha linhas para os outros 5 pontos
    }
    this.ctx.closePath(); // Fecha o caminho (do 6º ao 1º ponto)
    this.ctx.fillStyle = corFill; // Define a cor de preenchimento
    this.ctx.strokeStyle = this.CORES.LINHA; // Define a cor da borda
    this.ctx.lineWidth = 2; // Define a espessura da borda
    this.ctx.fill(); // Preenche o hexágono
    this.ctx.stroke(); // Desenha a borda
  }

  // Desenha as bordas coloridas do tabuleiro.
  desenharBordas() {
    this.ctx.lineWidth = 4; // Bordas mais grossas
    for (let r = 0; r < this.TAMANHO_TABULEIRO; r++) {
      for (let c = 0; c < this.TAMANHO_TABULEIRO; c++) {
        const [x, y] = this.calcularCentroHex(r, c);
        const pontos = this.calcularPontosHex(x, y);

        // Lógica para desenhar as linhas vermelhas (topo/base)
        // Se a célula está na 1ª linha (r === 0)...
        if (r === 0) {
          // ...desenha suas linhas superiores de vermelho.
          this.desenharLinha(pontos[4], pontos[5], this.CORES.VERMELHO);
          // (Lógica complexa para conectar com o vizinho)
          if (c < this.TAMANHO_TABULEIRO - 1) {
            const [x_prox, y_prox] = this.calcularCentroHex(r, c + 1);
            const pontos_prox = this.calcularPontosHex(x_prox, y_prox);
            this.desenharLinha(pontos[5], pontos_prox[4], this.CORES.VERMELHO);
          }
        }
        // Se a célula está na última linha...
        if (r === this.TAMANHO_TABULEIRO - 1) {
          // ...desenha suas linhas inferiores de vermelho.
          this.desenharLinha(pontos[1], pontos[2], this.CORES.VERMELHO);
          if (c < this.TAMANHO_TABULEIRO - 1) {
            const [x_prox, y_prox] = this.calcularCentroHex(r, c + 1);
            const pontos_prox = this.calcularPontosHex(x_prox, y_prox);
            this.desenharLinha(pontos[1], pontos_prox[2], this.CORES.VERMELHO);
          }
        }

        // Lógica para desenhar as linhas azuis (esquerda/direita)
        // Se a célula está na 1ª coluna (c === 0)...
        if (c === 0) {
          // ...desenha suas linhas da esquerda de azul.
          this.desenharLinha(pontos[2], pontos[3], this.CORES.AZUL);
          this.desenharLinha(pontos[3], pontos[4], this.CORES.AZUL);
        }
        // Se a célula está na última coluna...
        if (c === this.TAMANHO_TABULEIRO - 1) {
          // ...desenha suas linhas da direita de azul.
          this.desenharLinha(pontos[5], pontos[0], this.CORES.AZUL);
          this.desenharLinha(pontos[0], pontos[1], this.CORES.AZUL);
        }
      }
    }
  }

  // Função auxiliar de desenho para traçar uma única linha.
  desenharLinha(p1, p2, cor) {
    this.ctx.beginPath();
    this.ctx.moveTo(p1[0], p1[1]);
    this.ctx.lineTo(p2[0], p2[1]);
    this.ctx.strokeStyle = cor;
    this.ctx.stroke();
  }

  //! --- Funções Matemáticas de Coordenadas ---

  // Converte (linha, coluna) para coordenadas de pixel (x, y) no canvas.
  // Esta é a matemática que cria a grade hexagonal "inclinada".
  calcularCentroHex(r, c) {
    const hexAltura = this.TAMANHO_HEX * Math.sqrt(3);
    const hexLargura = this.TAMANHO_HEX * 2;
    const inicioX = 50; // Margem da esquerda
    const inicioY = 50; // Margem do topo
    const x = inicioX + ((hexLargura * 3) / 4) * c;
    const y = inicioY + hexAltura * r + (hexAltura / 2) * c;
    return [x, y];
  }

  // Dado um ponto central (x, y), calcula os 6 vértices (pontos) do hexágono.
  calcularPontosHex(centroX, centroY) {
    const pontos = [];
    for (let i = 0; i < 6; i++) {
      // Matemática trigonométrica (círculo dividido em 6 ângulos de 60º)
      const anguloRad = (Math.PI / 180) * (60 * i);
      const pontoX = centroX + this.TAMANHO_HEX * Math.cos(anguloRad);
      const pontoY = centroY + this.TAMANHO_HEX * Math.sin(anguloRad);
      pontos.push([pontoX, pontoY]);
    }
    return pontos;
  }

  //!
  //! Vez do jogador
  //!

  // Descobre qual hexágono (r, c) foi clicado com base nas coordenadas (x, y) do mouse.
  findHexClicado(evento) {
    // Pega a posição do mouse relativa ao canvas.
    const rect = this.canvas.getBoundingClientRect();
    const x = evento.clientX - rect.left;
    const y = evento.clientY - rect.top;

    let maisProximo = null;
    let menorDistancia = Infinity;

    // Itera sobre a lista de hexágonos salvos (criada em 'desenharHex').
    for (const hex of this.poligonosHex) {
      // Calcula a distância do clique ao centro de cada hexágono.
      const dist = Math.hypot(x - hex.x, y - hex.y);
      // Armazena o hexágono com a menor distância.
      if (dist < menorDistancia) {
        menorDistancia = dist;
        maisProximo = hex;
      }
    }
    // Se o clique foi "perto o suficiente" do centro (dentro do raio)...
    if (menorDistancia < this.TAMANHO_HEX * 0.9) {
      // 0.9 para uma margem de erro
      // ...retorna a linha e coluna (r, c) desse hexágono.
      return [maisProximo.r, maisProximo.c];
    }
    // Se clicou fora de qualquer hexágono, retorna nulo.
    return null;
  }

  // Função chamada quando o canvas é clicado.
  aoClicar(evento) {
    // 1. Se o jogo acabou ou é a vez da IA, ignora o clique.
    if (this.gameOver || this.isAITurn) {
      return;
    }
    // 2. Descobre qual célula (r, c) foi clicada.
    const clicado = this.findHexClicado(evento);

    if (clicado) {
      const [r, c] = clicado;
      const key = `${r},${c}`;
      // 3. Verifica se a célula está VAZIA.
      if (this.tabuleiroLogico[key] === this.JOGADOR_VAZIO) {
        // 4. Se sim, realiza a jogada.
        this.realizarJogada(r, c, this.jogadorAtual);
      } else {
        console.warn(`Posição (${r}, ${c}) já ocupada!`);
      }
    }
  }

  // Função que "confirma" uma jogada no tabuleiro.
  // É chamada tanto por 'aoClicar' (humano) quanto por 'chamarIA' (IA).
  realizarJogada(r, c, jogador) {
    const key = `${r},${c}`;
    // Verificação dupla para segurança (não deve acontecer).
    if (this.tabuleiroLogico[key] !== this.JOGADOR_VAZIO) return;

    // 1. Atualiza o "cérebro" (tabuleiro lógico).
    this.tabuleiroLogico[key] = jogador;
    // 2. Pega a cor correta.
    const cor =
      jogador === this.JOGADOR_AZUL ? this.CORES.AZUL : this.CORES.VERMELHO;
    // 3. Atualiza a "tela" (desenha o hexágono da cor do jogador).
    this.desenharHex(r, c, cor);
    // 4. Redesenha as bordas (para caso a jogada tenha sido na borda).
    this.desenharBordas();

    // 5. (Bloco 6) Verifica se esta jogada resultou em vitória.
    if (this.checarVitoria(jogador, this.tabuleiroLogico)) {
      this.gameOver = true;
      let vencedor = jogador === this.JOGADOR_AZUL ? "AZUL" : "VERMELHO";
      // Ajusta a mensagem de vitória para modos com IA.
      if (this.getModoJogo() !== "pvp") {
        vencedor =
          jogador === this.JOGADOR_VERMELHO
            ? "VERMELHO (IA)"
            : "AZUL (Humano/IA)";
      }
      this.setStatus(`FIM DE JOGO! Jogador ${vencedor} VENCEU!`);
    } else {
      // 6. Se o jogo não acabou, passa a vez.
      this.trocarJogador();
    }
  }

  // Gerencia a troca de turnos.
  trocarJogador() {
    if (this.gameOver) return;
    const modo = this.getModoJogo();

    if (this.jogadorAtual === this.JOGADOR_AZUL) {
      this.jogadorAtual = this.JOGADOR_VERMELHO;

      if (modo === "pvp") {
        this.isAITurn = false;
        this.setStatus("Vez do Jogador VERMELHO (Humano)");
      } else {
        this.isAITurn = true; // Bloqueia cliques
        this.setStatus("Vez da IA (VERMELHO)... Pensando...");

        setTimeout(() => this.chamarIA(), 50);
      }
    } else {
      this.jogadorAtual = this.JOGADOR_AZUL;
      this.setStatus("Vez do Jogador AZUL (Humano)");

      // Libera os cliques (após 1ms para garantir a ordem).
      setTimeout(() => {
        this.isAITurn = false;
      }, 1);
    }
  }

  //!
  //! Ação da IA
  //!

  // Função chamada por 'trocarJogador' ou 'reiniciarJogo' quando é a vez da IA.
  chamarIA() {
    if (this.gameOver) return;

    // 1. Lê as configurações da IA selecionadas pelo usuário.
    const algo = this.getAlgoIA();
    const depth = this.getProfundidadeIA();

    console.log(
      `IA (Jogador ${this.jogadorAtual}) pensando com algoritmo=${algo}, profundidade=${depth}...`
    );
    // 2. Mede o tempo de início do cálculo.
    const startTime = performance.now();

    let melhorJogada = null;
    // 3. Cria uma CÓPIA do tabuleiro para a IA "simular" jogadas.
    const boardState = { ...this.tabuleiroLogico };

    // O VERMELHO é o jogador MAX (quer maximizar o placar).
    if (algo === "alfabeta") {
      melhorJogada = this.encontrarMelhorJogada_AlfaBeta_MAX(boardState, depth);
    } else {
      melhorJogada = this.encontrarMelhorJogada_Minimax_MAX(boardState, depth);
    }

    // 4. Mede o tempo de fim e exibe no console.
    const endTime = performance.now();
    console.log(
      `Tempo de decisão da IA: ${((endTime - startTime) / 1000).toFixed(
        4
      )} segundos.`
    );

    // 5. Realiza a melhor jogada encontrada.
    if (melhorJogada) {
      this.realizarJogada(melhorJogada[0], melhorJogada[1], this.jogadorAtual);
    } else {
      // 6. (Emergência) Se nenhum algoritmo retornou uma jogada,
      //    joga na primeira casa vazia que encontrar.
      const jogadaEmergencia = this.getJogadasValidas(boardState)[0];
      if (jogadaEmergencia && !this.gameOver) {
        console.warn("IA usando jogada de emergência.");
        this.realizarJogada(
          jogadaEmergencia[0],
          jogadaEmergencia[1],
          this.jogadorAtual
        );
      }
    }
  }

  //!
  //! BLOCO 6: LÓGICA DE GRAFO (Vizinhos, Vitória)
  //!

  // Retorna uma lista de vizinhos válidos (r, c) para uma dada célula (r, c).
  getVizinhos(r, c, boardState) {
    const vizinhos = [];
    // Lista de todas as 6 posições relativas de um hexágono.
    const potenciaisVizinhos = [
      [r - 1, c],
      [r - 1, c + 1],
      [r, c + 1],
      [r + 1, c],
      [r + 1, c - 1],
      [r, c - 1],
    ];
    for (const [vr, vc] of potenciaisVizinhos) {
      const key = `${vr},${vc}`;
      // 'boardState.hasOwnProperty(key)' verifica se a célula (vr, vc)
      // realmente existe dentro do tabuleiro (ex: não é [-1, 0]).
      if (boardState.hasOwnProperty(key)) {
        vizinhos.push([vr, vc]);
      }
    }
    return vizinhos;
  }

  // Verifica se um jogador venceu usando um algoritmo de Busca em Largura (BFS).
  checarVitoria(jogador, boardState) {
    const fila = []; // A fila de células a visitar.
    const visitados = new Set(); // Células já visitadas (para evitar loops).

    let bordaInicio = [];
    let condicaoFim = () => false;

    // Define as bordas de início e fim com base no jogador.
    if (jogador === this.JOGADOR_AZUL) {
      // Azul: conecta Esquerda (c=0) -> Direita (c=N-1).
      bordaInicio = Array.from({ length: this.TAMANHO_TABULEIRO }, (_, i) => [
        i,
        0,
      ]);
      condicaoFim = (r, c) => c === this.TAMANHO_TABULEIRO - 1;
    } else {
      // Vermelho: conecta Topo (r=0) -> Base (r=N-1).
      bordaInicio = Array.from({ length: this.TAMANHO_TABULEIRO }, (_, i) => [
        0,
        i,
      ]);
      condicaoFim = (r, c) => r === this.TAMANHO_TABULEIRO - 1;
    }

    // 1. Adiciona todas as peças do jogador na borda de INÍCIO à fila.
    for (const [r, c] of bordaInicio) {
      const key = `${r},${c}`;
      if (boardState[key] === jogador) {
        fila.push([r, c]);
        visitados.add(key);
      }
    }

    // 2. Inicia a busca (BFS).
    while (fila.length > 0) {
      const [rAtual, cAtual] = fila.shift(); // Pega o primeiro da fila.

      // 3. CONDIÇÃO DE VITÓRIA: Chegamos na borda de FIM?
      if (condicaoFim(rAtual, cAtual)) {
        return true; // Vitória!
      }

      // 4. Se não, olha os vizinhos.
      for (const [vr, vc] of this.getVizinhos(rAtual, cAtual, boardState)) {
        const keyVizinho = `${vr},${vc}`;
        // Se o vizinho pertence ao jogador E ainda não foi visitado...
        if (!visitados.has(keyVizinho) && boardState[keyVizinho] === jogador) {
          visitados.add(keyVizinho); // ...marca como visitado.
          fila.push([vr, vc]); // ...adiciona à fila para ser explorado.
        }
      }
    }
    // 5. Se a fila esvaziou e nunca chegamos ao fim, o jogador não venceu.
    return false;
  }

  //!
  //! Algoritmos da IA (Minimax, Alfa-Beta)
  //!

  // --- Funções Auxiliares da IA ---

  // Retorna uma lista de todas as jogadas (células) VAZIAS.
  getJogadasValidas(boardState) {
    const jogadas = [];
    for (let r = 0; r < this.TAMANHO_TABULEIRO; r++) {
      for (let c = 0; c < this.TAMANHO_TABULEIRO; c++) {
        if (boardState[`${r},${c}`] === this.JOGADOR_VAZIO) {
          jogadas.push([r, c]);
        }
      }
    }
    return jogadas;
  }

  // "Finge" uma jogada. Cria uma CÓPIA do tabuleiro com a jogada aplicada.
  // Isso é crucial para a IA explorar o futuro sem alterar o tabuleiro real.
  simularJogada(boardState, jogada, jogador) {
    const [r, c] = jogada;
    const novoBoard = { ...boardState }; // Cria a cópia
    novoBoard[`${r},${c}`] = jogador; // Aplica a jogada na cópia
    return novoBoard; // Retorna a cópia
  }

  //! --- ALGORITMO 1: MINIMAX PURO ---

  // Função "de topo" para o MAX (Vermelho).
  encontrarMelhorJogada_Minimax_MAX(boardState, depth) {
    let melhorPontuacao = -Infinity;
    let melhorJogada = null;

    // 1. Para cada jogada possível...
    for (const jogada of this.getJogadasValidas(boardState)) {
      // 2. ...simula a jogada.
      const novoBoard = this.simularJogada(
        boardState,
        jogada,
        this.JOGADOR_VERMELHO
      );
      // 3. ...chama o 'minimax_puro' para o turno do MIN (oponente).
      const pontuacao = this.minimax_puro(novoBoard, depth - 1, false);
      // 4. Se a pontuação for melhor, OU se for a primeira jogada testada...
      if (pontuacao > melhorPontuacao || melhorJogada === null) {
        melhorPontuacao = pontuacao; // ...salva a pontuação...
        melhorJogada = jogada; // ...e salva a jogada.
      }
    }

    return melhorJogada;
  }

  // A função recursiva principal do Minimax.
  minimax_puro(boardState, depth, isMaximizingPlayer) {
    // --- CASOS BASE (Condições de Parada) ---
    // 1. Se o jogo acabou (vitória do MIN), retorna -Infinito (péssimo para MAX).
    if (this.checarVitoria(this.JOGADOR_AZUL, boardState)) return -Infinity;
    // 2. Se o jogo acabou (vitória do MAX), retorna +Infinito (ótimo para MAX).
    if (this.checarVitoria(this.JOGADOR_VERMELHO, boardState)) return Infinity;
    // 3. Se atingiu a profundidade limite, chama a "intuição" (heurística).
    if (depth === 0) return this.funcaoHeuristica(boardState);

    // --- PASSO RECURSIVO ---
    const jogadasValidas = this.getJogadasValidas(boardState);

    if (isMaximizingPlayer) {
      // Turno do MAX (Vermelho)
      let melhorPontuacao = -Infinity;
      for (const jogada of jogadasValidas) {
        // Chama a si mesmo para o turno do MIN.
        const pontuacao = this.minimax_puro(
          this.simularJogada(boardState, jogada, this.JOGADOR_VERMELHO),
          depth - 1,
          false // Próximo é o MIN
        );
        // MAX quer a maior pontuação.
        melhorPontuacao = Math.max(melhorPontuacao, pontuacao);
      }
      return melhorPontuacao;
    } else {
      // Turno do MIN (Azul)
      let melhorPontuacao = Infinity;
      for (const jogada of jogadasValidas) {
        // Chama a si mesmo para o turno do MAX.
        const pontuacao = this.minimax_puro(
          this.simularJogada(boardState, jogada, this.JOGADOR_AZUL),
          depth - 1,
          true // Próximo é o MAX
        );
        // MIN quer a menor pontuação.
        melhorPontuacao = Math.min(melhorPontuacao, pontuacao);
      }
      return melhorPontuacao;
    }
  }

  //! --- ALGORITMO 2: MINIMAX ALFA-BETA ---

  // Função "de topo" para o MAX (Vermelho).
  encontrarMelhorJogada_AlfaBeta_MAX(boardState, depth) {
    let melhorPontuacao = -Infinity;
    let melhorJogada = null;
    let alpha = -Infinity; // 'alpha': O melhor (maior) placar que o MAX já encontrou.
    let beta = Infinity; // 'beta': O melhor (menor) placar que o MIN já encontrou.
    for (const jogada of this.getJogadasValidas(boardState)) {
      const novoBoard = this.simularJogada(
        boardState,
        jogada,
        this.JOGADOR_VERMELHO
      );
      // Chama a recursão 'alfabeta' para o turno do MIN.
      const pontuacao = this.minimax_alfabeta(
        novoBoard,
        depth - 1,
        false, // Próximo é o MIN
        alpha,
        beta
      );
      if (pontuacao > melhorPontuacao || melhorJogada === null) {
        melhorPontuacao = pontuacao; // ...salva a pontuação...
        melhorJogada = jogada; // ...e salva a jogada.
      }
      // Atualiza o 'alpha' (o melhor placar que o MAX pode forçar).
      alpha = Math.max(alpha, melhorPontuacao);
    }
    return melhorJogada;
  }

  // A função recursiva principal do Alfa-Beta.
  minimax_alfabeta(boardState, depth, isMaximizingPlayer, alpha, beta) {
    // --- CASOS BASE (Idênticos ao Minimax) ---
    if (this.checarVitoria(this.JOGADOR_AZUL, boardState)) return -Infinity;
    if (this.checarVitoria(this.JOGADOR_VERMELHO, boardState)) return Infinity;
    if (depth === 0) return this.funcaoHeuristica(boardState);

    // --- PASSO RECURSIVO ---
    const jogadasValidas = this.getJogadasValidas(boardState);

    if (isMaximizingPlayer) {
      // Turno do MAX (Vermelho)
      let melhorPontuacao = -Infinity;
      for (const jogada of jogadasValidas) {
        const pontuacao = this.minimax_alfabeta(
          this.simularJogada(boardState, jogada, this.JOGADOR_VERMELHO),
          depth - 1,
          false,
          alpha,
          beta
        );
        melhorPontuacao = Math.max(melhorPontuacao, pontuacao);
        alpha = Math.max(alpha, melhorPontuacao); // Atualiza alpha
        // --- A PODA (O "CORTE") ---
        // Se 'alpha' (o que MAX pode garantir) é maior ou igual a 'beta'
        // (o que MIN já pode garantir), o MIN nunca deixará o jogo chegar aqui.
        // Então, paramos de procurar neste ramo.
        if (alpha >= beta) break;
      }
      return melhorPontuacao;
    } else {
      // Turno do MIN (Azul)
      let melhorPontuacao = Infinity;
      for (const jogada of jogadasValidas) {
        const pontuacao = this.minimax_alfabeta(
          this.simularJogada(boardState, jogada, this.JOGADOR_AZUL),
          depth - 1,
          true,
          alpha,
          beta
        );
        melhorPontuacao = Math.min(melhorPontuacao, pontuacao);
        beta = Math.min(beta, melhorPontuacao); // Atualiza beta
        // --- A PODA (O "CORTE") ---
        // Se 'alpha' >= 'beta', paramos de procurar.
        if (alpha >= beta) break;
      }
      return melhorPontuacao;
    }
  }

  //!
  //! Heurística (A "Intuição" da IA)
  //!

  // Ela "adivinha" quem está ganhando com base no estado atual do tabuleiro.
  funcaoHeuristica(boardState) {
    // 1. Calcula o "custo" do caminho mais curto para o Azul vencer.
    const custoAzul = this._menorCaminho(boardState, this.JOGADOR_AZUL);
    // 2. Calcula o "custo" do caminho mais curto para o Vermelho vencer.
    const custoVermelho = this._menorCaminho(boardState, this.JOGADOR_VERMELHO);

    // 3. A "fórmula":
    //    Queremos minimizar 'custoVermelho' (nosso ataque)
    //    Queremos maximizar 'custoAzul' (nossa defesa / bloquear oponente)
    //    Damos um peso maior (1.5x) para a defesa.
    //    (O placar é do ponto de vista do MAX/Vermelho,
    //     por isso subtraímos 'custoVermelho' e somamos 'custoAzul').
    return custoAzul * 1.5 - custoVermelho;
  }

  // Encontra o caminho "mais barato" de uma borda a outra usando um
  // algoritmo de Busca 0-1 (uma variação otimizada de Dijkstra).
  _menorCaminho(board, jogador) {
    const oponente =
      jogador === this.JOGADOR_AZUL ? this.JOGADOR_VERMELHO : this.JOGADOR_AZUL;

    let bordaInicio = [];
    let bordaFim = [];

    // Define as bordas de início/fim (igual ao 'checarVitoria').
    if (jogador === this.JOGADOR_AZUL) {
      bordaInicio = Array.from({ length: this.TAMANHO_TABULEIRO }, (_, i) => [
        i,
        0,
      ]);
      bordaFim = Array.from({ length: this.TAMANHO_TABULEIRO }, (_, i) => [
        i,
        this.TAMANHO_TABULEIRO - 1,
      ]);
    } else {
      bordaInicio = Array.from({ length: this.TAMANHO_TABULEIRO }, (_, i) => [
        0,
        i,
      ]);
      bordaFim = Array.from({ length: this.TAMANHO_TABULEIRO }, (_, i) => [
        this.TAMANHO_TABULEIRO - 1,
        i,
      ]);
    }

    // Armazena o custo mínimo para chegar em cada célula.
    const custos = {};
    // Fila de Prioridade 0-1 (células de custo 0 vão para o início, custo 1 para o fim).
    const fila = [];
    const visitados = new Set();

    // Inicializa todos os custos como Infinito.
    for (let r = 0; r < this.TAMANHO_TABULEIRO; r++) {
      for (let c = 0; c < this.TAMANHO_TABULEIRO; c++) {
        custos[`${r},${c}`] = Infinity;
      }
    }

    // Define os custos iniciais para a borda de INÍCIO.
    for (const [r, c] of bordaInicio) {
      const key = `${r},${c}`;
      let custoInicial = Infinity;
      if (board[key] === jogador) custoInicial = 0; // Célula sua: custo 0
      else if (board[key] === this.JOGADOR_VAZIO) custoInicial = 1; // Célula vazia: custo 1
      // (Célula do oponente: custo Infinito, nem entra na fila)

      if (custoInicial !== Infinity) {
        custos[key] = custoInicial;
        // Fila 0-1: custo 0 vai no INÍCIO, custo 1 vai no FIM.
        if (custoInicial === 0) fila.unshift([r, c]);
        else fila.push([r, c]);
      }
    }

    // Inicia a busca 0-1.
    while (fila.length > 0) {
      const [rAtual, cAtual] = fila.shift(); // Sempre pega o de menor custo (início da fila).
      const keyAtual = `${rAtual},${cAtual}`;

      if (visitados.has(keyAtual)) {
        continue; // Já processamos esta célula (com um custo menor).
      }
      visitados.add(keyAtual);

      // --- LÓGICA 1: VIZINHOS ADJACENTES ---
      // Explora os 6 vizinhos diretos.
      for (const [vr, vc] of this.getVizinhos(rAtual, cAtual, board)) {
        const keyVizinho = `${vr},${vc}`;
        let custoMovimento = Infinity;
        if (board[keyVizinho] === jogador)
          custoMovimento = 0; // Mover para peça sua: custo 0
        else if (board[keyVizinho] === this.JOGADOR_VAZIO) custoMovimento = 1; // Mover para peça vazia: custo 1

        const novoCusto = custos[keyAtual] + custoMovimento;
        // Se encontramos um caminho MAIS BARATO para este vizinho...
        if (novoCusto < custos[keyVizinho]) {
          custos[keyVizinho] = novoCusto; // ...atualiza o custo...
          // ...e adiciona na fila de prioridade 0-1.
          if (custoMovimento === 0) fila.unshift([vr, vc]);
          else fila.push([vr, vc]);
        }
      }

      // --- LÓGICA 2: PONTES-DIAMANTE (Avançado) ---
      // Esta lógica permite à IA "pular" casas usando uma ponte.
      // Só podemos fazer pontes a partir de peças que já possuímos (custo 0).
      if (board[keyAtual] === jogador) {
        const vizinhos = this.getVizinhos(rAtual, cAtual, board);
        for (let i = 0; i < vizinhos.length; i++) {
          const [v1_r, v1_c] = vizinhos[i]; // Vizinho 1
          const [v2_r, v2_c] = vizinhos[(i + 1) % vizinhos.length]; // Vizinho 2 (ao lado do 1)

          const keyV1 = `${v1_r},${v1_c}`;
          const keyV2 = `${v2_r},${v2_c}`;

          // Se os DOIS hexágonos intermediários estão VAZIOS...
          if (
            board[keyV1] === this.JOGADOR_VAZIO &&
            board[keyV2] === this.JOGADOR_VAZIO
          ) {
            // ...encontra o 4º ponto do diamante (o "parceiro de ponte").
            // (Matemática vetorial para encontrar o 4º ponto)
            const pr = v1_r + v2_r - rAtual;
            const pc = v1_c + v2_c - cAtual;
            const keyParceiro = `${pr},${pc}`;

            // Se o parceiro existe e NÃO é do oponente...
            if (
              board.hasOwnProperty(keyParceiro) &&
              board[keyParceiro] !== oponente
            ) {
              // Custo 1 (se o parceiro for VAZIO, pois temos que jogar lá)
              // Custo 0 (se o parceiro já for NOSSO, a ponte já está "ameaçada")
              const custoPonte =
                board[keyParceiro] === this.JOGADOR_VAZIO ? 1 : 0;

              const novoCusto = custos[keyAtual] + custoPonte;

              // Se encontramos um caminho MAIS BARATO para o parceiro...
              if (novoCusto < custos[keyParceiro]) {
                custos[keyParceiro] = novoCusto; // ...atualiza o custo...
                // ...e adiciona na fila 0-1.
                if (custoPonte === 0) fila.unshift([pr, pc]);
                else fila.push([pr, pc]);
              }
            }
          }
        }
      }
    }

    // 6. Após a busca, verifica o menor custo para chegar em QUALQUER célula da borda de FIM.
    let custoFinalMinimo = Infinity;
    for (const [r, c] of bordaFim) {
      custoFinalMinimo = Math.min(custoFinalMinimo, custos[`${r},${c}`]);
    }
    return custoFinalMinimo; // Retorna o custo do melhor caminho.
  }
}
