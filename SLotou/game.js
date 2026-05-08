/* ═══════════════════════════════════════════
   MEGA SLOTS — Game Engine
   3 Rows × 5 Columns — 243 Ways to Win
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── Symbol Definitions ───
  // Symbol pays are per-way (multiplied by number of ways)
  const SYMBOLS = [
    { id: 'wild',    emoji: '🃏', name: 'Wild',      weight: 2,  pays: [0, 0, 5, 15, 50] },
    { id: 'diamond', emoji: '💎', name: 'Diamante',  weight: 3,  pays: [0, 0, 4, 10, 30] },
    { id: 'seven',   emoji: '7️⃣',  name: 'Siete',     weight: 4,  pays: [0, 0, 3, 8, 25] },
    { id: 'bell',    emoji: '🔔', name: 'Campana',   weight: 5,  pays: [0, 0, 2.5, 5, 15] },
    { id: 'cherry',  emoji: '🍒', name: 'Cereza',    weight: 7,  pays: [0, 0, 2, 4, 12] },
    { id: 'lemon',   emoji: '🍋', name: 'Limón',     weight: 8,  pays: [0, 0, 1.5, 3, 8] },
    { id: 'grape',   emoji: '🍇', name: 'Uva',       weight: 8,  pays: [0, 0, 1.5, 3, 8] },
    { id: 'orange',  emoji: '🍊', name: 'Naranja',   weight: 9,  pays: [0, 0, 1, 2, 5] },
    { id: 'bar',     emoji: '🏷️', name: 'BAR',       weight: 6,  pays: [0, 0, 2, 4.5, 14] },
    { id: 'scatter', emoji: '⭐', name: 'Scatter',   weight: 3,  pays: [0, 0, 5, 20, 100] },
  ];

  // 243 Ways to Win (3^5) — no paylines needed

  // ─── Game State ───
  const state = {
    balance: 1000,
    bet: 10,
    betStep: 10,
    minBet: 10,
    maxBet: 500,
    lastWin: 0,
    jackpot: 50000,
    spinning: false,
    autoSpin: false,
    autoSpinCount: 0,
    freeSpins: 0,
    bonusMultiplier: 1,
    bonusPending: false,
    grid: [], // 3×5 grid: grid[row][col]
    history: [],
    soundEnabled: false,
  };

  // ─── DOM References ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DOM = {
    balance: $('#balance'),
    betAmount: $('#betAmount'),
    lastWin: $('#lastWin'),
    jackpotAmount: $('#jackpotAmount'),
    spinBtn: $('#spinBtn'),
    autoBtn: $('#autoBtn'),
    maxBetBtn: $('#maxBetBtn'),
    betUp: $('#betUp'),
    betDown: $('#betDown'),
    reelsContainer: $('#reelsContainer'),
    winOverlay: $('#winOverlay'),
    winText: $('#winText'),
    machineFrame: $('.machine-frame'),
    paytableToggle: $('#paytableToggle'),
    paytable: $('#paytable'),
    paytableGrid: $('#paytableGrid'),
    particles: $('#particles'),
    autoSpinLabel: $('#autoSpinLabel'),
    autoSpinCount: $('#autoSpinCount'),
    soundToggle: $('#soundToggle'),
    audioControls: $('#audioControls'),
    musicToggle: $('#musicToggle'),
    volumeSlider: $('#volumeSlider'),
    bonusOverlay: $('#bonusOverlay'),
    bonusChoices: $('#bonusChoices'),
    bonusIntro: $('#bonusIntro'),
    bonusContent: $('#bonusContent'),
  };

  // ─── Weighted Random Symbol ───
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

  function randomSymbol() {
    let r = Math.random() * totalWeight;
    for (const sym of SYMBOLS) {
      r -= sym.weight;
      if (r <= 0) return sym;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  // ─── Build Reel Strips ───
  // Each reel shows 3 symbols (the grid rows)
  // We generate extra symbols above/below for animation
  const EXTRA_SYMBOLS = 20; // symbols to "scroll through" during spin

  function buildReelStrip(reelIndex, finalSymbols) {
    const reel = $(`#reel-${reelIndex} .reel-strip`);
    reel.innerHTML = '';
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0)';

    // Random filler symbols, then the 3 final symbols
    const allSymbols = [];
    for (let i = 0; i < EXTRA_SYMBOLS; i++) {
      allSymbols.push(randomSymbol());
    }
    // Final 3 (top, mid, bottom)
    allSymbols.push(finalSymbols[0], finalSymbols[1], finalSymbols[2]);

    allSymbols.forEach((sym, i) => {
      const div = document.createElement('div');
      div.className = 'symbol';
      div.textContent = sym.emoji;
      div.dataset.symbolId = sym.id;
      div.dataset.index = i;
      reel.appendChild(div);
    });

    return reel;
  }

  // ─── Initialize Grid ───
  function initGrid() {
    state.grid = [];
    for (let row = 0; row < 3; row++) {
      state.grid[row] = [];
      for (let col = 0; col < 5; col++) {
        state.grid[row][col] = randomSymbol();
      }
    }
    renderStaticGrid();
  }

  function renderStaticGrid() {
    for (let col = 0; col < 5; col++) {
      const reel = $(`#reel-${col} .reel-strip`);
      reel.innerHTML = '';
      reel.style.transition = 'none';
      reel.style.transform = 'translateY(0)';

      for (let row = 0; row < 3; row++) {
        const sym = state.grid[row][col];
        const div = document.createElement('div');
        div.className = 'symbol';
        div.textContent = sym.emoji;
        div.dataset.symbolId = sym.id;
        div.dataset.row = row;
        div.dataset.col = col;
        reel.appendChild(div);
      }
    }
  }

  // ─── Spin Logic ───
  async function spin() {
    if (state.spinning) return;

    // Check balance
    const cost = state.freeSpins > 0 ? 0 : state.bet;
    if (state.balance < cost) {
      showToast('💸 Balance insuficiente');
      AudioEngine.errorSound();
      stopAutoSpin();
      return;
    }

    state.spinning = true;
    state.balance -= cost;
    if (state.freeSpins > 0) state.freeSpins--;
    state.lastWin = 0;

    updateUI();
    clearHighlights();
    DOM.winOverlay.classList.remove('show');
    DOM.machineFrame.classList.remove('win-state');
    DOM.machineFrame.classList.add('spinning');
    DOM.spinBtn.disabled = true;
    DOM.spinBtn.classList.add('spinning');

    // 🔊 Spin start sound + reel ticks
    AudioEngine.spinStart();
    const totalSpinDuration = 1200 + 4 * 200 + 200; // last reel duration + buffer
    AudioEngine.startReelTicks(totalSpinDuration);

    // Generate new grid
    const newGrid = [];
    for (let row = 0; row < 3; row++) {
      newGrid[row] = [];
      for (let col = 0; col < 5; col++) {
        newGrid[row][col] = randomSymbol();
      }
    }

    // Animate each reel with stagger
    const reelPromises = [];
    for (let col = 0; col < 5; col++) {
      const finalSyms = [newGrid[0][col], newGrid[1][col], newGrid[2][col]];
      reelPromises.push(animateReel(col, finalSyms, col * 150));
    }

    await Promise.all(reelPromises);

    // 🔊 Stop ticks
    AudioEngine.stopReelTicks();

    state.grid = newGrid;
    state.spinning = false;
    DOM.machineFrame.classList.remove('spinning');
    DOM.spinBtn.disabled = false;
    DOM.spinBtn.classList.remove('spinning');

    // Evaluate wins
    evaluateWins();
  }

  function animateReel(colIndex, finalSymbols, delay) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const strip = buildReelStrip(colIndex, finalSymbols);
        const symbolSize = getSymbolSize();
        const totalSymbols = EXTRA_SYMBOLS + 3;
        const targetOffset = -(totalSymbols - 3) * symbolSize;

        // Force reflow
        strip.offsetHeight;

        // Animate
        const duration = 1200 + colIndex * 200;
        strip.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.35, 1.02)`;
        strip.style.transform = `translateY(${targetOffset}px)`;

        // 🔊 Reel stop sound + visual flash when reel lands
        setTimeout(() => {
          AudioEngine.reelStop(colIndex);
          const reel = $(`#reel-${colIndex}`);
          reel.style.borderColor = 'rgba(168, 85, 247, 0.4)';
          setTimeout(() => {
            reel.style.borderColor = '';
          }, 150);
          resolve();
        }, duration);
      }, delay);
    });
  }

  function getSymbolSize() {
    const sym = document.querySelector('.symbol');
    if (sym) return sym.offsetHeight;
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--symbol-size'));
  }

  // ─── Win Evaluation (243 Ways to Win) ───
  function evaluateWins() {
    let totalWin = 0;
    const winningCells = new Set();
    let totalWinningWays = 0;

    // Check each symbol for ways wins
    const symbolsToCheck = SYMBOLS.filter(s => s.id !== 'scatter');

    for (const sym of symbolsToCheck) {
      // For each reel, count how many positions match this symbol (or wild)
      let consecutiveReels = 0;
      const waysPerReel = [];
      const matchingPositions = [];

      for (let col = 0; col < 5; col++) {
        let count = 0;
        const positions = [];
        for (let row = 0; row < 3; row++) {
          const cellSym = state.grid[row][col];
          if (cellSym.id === sym.id || cellSym.id === 'wild') {
            count++;
            positions.push(row);
          }
        }
        if (count > 0) {
          consecutiveReels++;
          waysPerReel.push(count);
          matchingPositions.push(positions);
        } else {
          break; // must be consecutive from left
        }
      }

      if (consecutiveReels >= 3) {
        // Ways = product of matching positions per reel
        const ways = waysPerReel.reduce((a, b) => a * b, 1);
        const basePay = sym.pays[consecutiveReels - 1];
        let payout = basePay * ways * (state.bet / state.minBet);
        // Apply bonus multiplier during free spins
        if (state.freeSpins > 0 || state.bonusMultiplier > 1) {
          payout *= state.bonusMultiplier;
        }
        totalWin += payout;
        totalWinningWays += ways;

        // Mark winning cells
        for (let col = 0; col < consecutiveReels; col++) {
          matchingPositions[col].forEach(row => {
            winningCells.add(`${row}-${col}`);
          });
        }
      }
    }

    // Check scatter (anywhere on grid, all 5 reels)
    let scatterCount = 0;
    const scatterCells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        if (state.grid[row][col].id === 'scatter') {
          scatterCount++;
          scatterCells.push(`${row}-${col}`);
        }
      }
    }

    if (scatterCount >= 3) {
      const scatterSym = SYMBOLS.find(s => s.id === 'scatter');
      const payout = scatterSym.pays[scatterCount - 1] * state.bet;
      totalWin += payout;
      scatterCells.forEach(c => winningCells.add(c));

      // Trigger bonus selection overlay
      state.bonusPending = true;

      // 🔊 Free spins sound
      AudioEngine.freeSpinsAwarded();
    }

    // Apply winnings
    if (totalWin > 0) {
      state.lastWin = Math.round(totalWin);
      state.balance += state.lastWin;

      // Jackpot contribution
      state.jackpot += Math.floor(state.bet * 0.01);

      // Show win
      highlightWinningCells(winningCells);
      showWin(state.lastWin, totalWinningWays);
      spawnCoins(state.lastWin);
    }

    updateUI();

    // If bonus triggered, show the bonus overlay and pause
    if (state.bonusPending) {
      state.bonusPending = false;
      const wasAutoSpin = state.autoSpin;
      if (state.autoSpin) stopAutoSpin();
      setTimeout(() => {
        showBonusOverlay(wasAutoSpin);
      }, totalWin > 0 ? 2200 : 800);
      return;
    }

    // Auto spin or free spins
    if (state.autoSpin || state.freeSpins > 0) {
      setTimeout(() => {
        if (state.autoSpin || state.freeSpins > 0) spin();
      }, totalWin > 0 ? 2000 : 600);
    }
  }

  // ─── Visual Effects ───
  function highlightWinningCells(cells) {
    // Re-render static grid then highlight
    renderStaticGrid();

    cells.forEach(key => {
      const [row, col] = key.split('-').map(Number);
      const reel = $(`#reel-${col} .reel-strip`);
      const symbols = reel.querySelectorAll('.symbol');
      if (symbols[row]) {
        symbols[row].classList.add('highlight');
      }
    });
  }

  function clearHighlights() {
    $$('.symbol.highlight').forEach(el => el.classList.remove('highlight'));
  }

  function showWin(amount, lineCount) {
    const multiplier = amount / state.bet;
    const isBig = multiplier >= 20;
    const isMega = multiplier >= 50;

    DOM.winText.textContent = `+$${amount.toLocaleString()}`;
    DOM.winText.className = 'win-text' + (isBig ? ' big-win' : '');
    DOM.winOverlay.classList.add('show');
    DOM.machineFrame.classList.add('win-state');

    // 🔊 Win sounds based on win size
    if (isMega) {
      AudioEngine.megaWin();
    } else if (isBig) {
      AudioEngine.bigWin();
    } else if (lineCount > 1) {
      AudioEngine.lineWin();
    } else {
      AudioEngine.smallWin();
    }

    // Animate balance counting
    animateValue(DOM.lastWin, 0, amount, 800, '$');

    setTimeout(() => {
      DOM.winOverlay.classList.remove('show');
      DOM.machineFrame.classList.remove('win-state');
    }, isBig ? 3000 : 2000);
  }

  function animateValue(el, start, end, duration, prefix = '') {
    const startTime = performance.now();
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * eased);
      el.textContent = `${prefix}${current.toLocaleString()}`;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function spawnCoins(amount) {
    const count = Math.min(Math.floor(amount / state.bet) * 3, 30);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const coin = document.createElement('div');
        coin.className = 'coin';
        coin.textContent = '🪙';
        coin.style.left = `${centerX}px`;
        coin.style.top = `${centerY}px`;

        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 300;
        coin.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        coin.style.setProperty('--dy', `${Math.sin(angle) * dist - 150}px`);

        document.body.appendChild(coin);

        // 🔊 Coin drop sound
        AudioEngine.coinDrop();

        setTimeout(() => coin.remove(), 1300);
      }, i * 50);
    }
  }

  // ─── Toast Notification ───
  let toastTimeout;
  function showToast(message) {
    let toast = $('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function stopAutoSpin() {
    state.autoSpin = false;
    DOM.autoBtn.classList.remove('active');
  }

  // ─── UI Updates ───
  function updateUI() {
    DOM.balance.textContent = `$${state.balance.toLocaleString()}`;
    DOM.betAmount.textContent = `$${state.bet.toLocaleString()}`;
    DOM.lastWin.textContent = `$${state.lastWin.toLocaleString()}`;
    DOM.jackpotAmount.textContent = `$${state.jackpot.toLocaleString()}`;

    // Free spins indicator
    let banner = $('.free-spins-banner');
    if (state.freeSpins > 0) {
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'free-spins-banner';
        DOM.machineFrame.parentNode.insertBefore(banner, DOM.machineFrame);
      }
      banner.textContent = `🎁 GIROS GRATIS: ${state.freeSpins} — x${state.bonusMultiplier} Multiplicador`;
      banner.classList.add('visible');
    } else if (banner) {
      banner.classList.remove('visible');
      // Reset multiplier when free spins end
      if (state.bonusMultiplier > 1) {
        state.bonusMultiplier = 1;
      }
    }
  }

  // ─── Audio Controls ───
  function initAudioControls() {
    // Sound toggle button (master on/off)
    DOM.soundToggle.addEventListener('click', () => {
      if (!AudioEngine.isInitialized) {
        // First click: initialize the audio context (requires user gesture)
        AudioEngine.init();
        state.soundEnabled = true;
        DOM.soundToggle.classList.add('active');
        DOM.soundToggle.textContent = '🔊';
        DOM.audioControls.style.display = 'flex';
        AudioEngine.buttonClick();
      } else {
        // Toggle mute
        const muted = AudioEngine.toggleMute();
        state.soundEnabled = !muted;
        DOM.soundToggle.classList.toggle('active', !muted);
        DOM.soundToggle.textContent = muted ? '🔇' : '🔊';
        DOM.audioControls.style.display = muted ? 'none' : 'flex';
      }
    });

    // Music toggle
    DOM.musicToggle.addEventListener('click', () => {
      AudioEngine.buttonClick();
      const playing = AudioEngine.toggleMusic();
      DOM.musicToggle.classList.toggle('active', playing);
      DOM.musicToggle.textContent = playing ? 'ON' : 'OFF';
    });

    // Volume slider
    DOM.volumeSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value) / 100;
      AudioEngine.setMasterVolume(vol);
    });
  }

  // ─── Event Listeners ───
  DOM.spinBtn.addEventListener('click', () => {
    AudioEngine.buttonClick();
    spin();
  });

  DOM.betUp.addEventListener('click', () => {
    if (state.spinning) return;
    AudioEngine.buttonClick();
    state.bet = Math.min(state.bet + state.betStep, state.maxBet);
    updateUI();
  });

  DOM.betDown.addEventListener('click', () => {
    if (state.spinning) return;
    AudioEngine.buttonClick();
    state.bet = Math.max(state.bet - state.betStep, state.minBet);
    updateUI();
  });

  DOM.maxBetBtn.addEventListener('click', () => {
    if (state.spinning) return;
    AudioEngine.buttonClick();
    state.bet = state.maxBet;
    updateUI();
  });

  DOM.autoBtn.addEventListener('click', () => {
    AudioEngine.buttonClick();
    state.autoSpin = !state.autoSpin;
    DOM.autoBtn.classList.toggle('active', state.autoSpin);
    if (state.autoSpin && !state.spinning) {
      spin();
    }
  });

  DOM.paytableToggle.addEventListener('click', () => {
    AudioEngine.buttonClick();
    DOM.paytable.classList.toggle('open');
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!state.spinning) spin();
    }
  });

  // ─── Build Paytable ───
  function buildPaytable() {
    DOM.paytableGrid.innerHTML = '';
    SYMBOLS.forEach(sym => {
      const item = document.createElement('div');
      item.className = 'pay-item';
      item.innerHTML = `
        <span class="pay-symbol">${sym.emoji}</span>
        <span class="pay-name">${sym.name}</span>
        <span class="pay-values">
          ×3: ${sym.pays[2]}x<br>
          ×4: ${sym.pays[3]}x<br>
          ×5: ${sym.pays[4]}x
        </span>
      `;
      DOM.paytableGrid.appendChild(item);
    });
  }

  // ─── Background Particles ───
  function createParticles() {
    const colors = ['#ffd700', '#a855f7', '#00d4ff', '#ff4d6d', '#22c55e'];
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 4;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDuration = `${8 + Math.random() * 15}s`;
      p.style.animationDelay = `${Math.random() * 10}s`;
      p.style.boxShadow = `0 0 ${size * 2}px ${p.style.background}`;
      DOM.particles.appendChild(p);
    }
  }

  // ─── Jackpot Animation ───
  function animateJackpot() {
    setInterval(() => {
      state.jackpot += Math.floor(Math.random() * 50);
      DOM.jackpotAmount.textContent = `$${state.jackpot.toLocaleString()}`;
    }, 3000);
  }

  // ─── Bonus System ───
  function showBonusOverlay(wasAutoSpin) {
    // Reset card states
    $$('.bonus-card').forEach(c => {
      c.classList.remove('selected', 'not-selected');
    });

    // Force-restart CSS animations by removing and re-adding the overlay class
    DOM.bonusOverlay.classList.remove('active');
    // Force reflow to reset animations
    void DOM.bonusOverlay.offsetHeight;
    DOM.bonusOverlay.classList.add('active');

    // Re-trigger animations on children by cloning the symbol
    const symbolEl = document.getElementById('bonusSymbolAnim');
    const newSymbol = symbolEl.cloneNode(true);
    symbolEl.parentNode.replaceChild(newSymbol, symbolEl);

    // Spawn bonus particles
    spawnBonusParticles();

    // Play bonus sound
    AudioEngine.freeSpinsAwarded();

    // Attach click handlers
    const cards = $$('.bonus-card');
    const handleChoice = (e) => {
      const card = e.currentTarget;
      const volatility = card.dataset.volatility;

      AudioEngine.buttonClick();

      // Visual feedback: selected card & fade others
      cards.forEach(c => {
        if (c === card) {
          c.classList.add('selected');
        } else {
          c.classList.add('not-selected');
        }
        c.removeEventListener('click', handleChoice);
      });

      // Set free spins and multiplier based on choice
      let spins, multiplier;
      switch (volatility) {
        case 'low':
          spins = 20;
          multiplier = 2;
          break;
        case 'medium':
          spins = 10;
          multiplier = 5;
          break;
        case 'high':
          spins = 5;
          multiplier = 10;
          break;
      }

      state.freeSpins += spins;
      state.bonusMultiplier = multiplier;

      showToast(`⭐ ¡${spins} Giros Gratis con x${multiplier}!`);

      // Close overlay after a moment
      setTimeout(() => {
        closeBonusOverlay();
        updateUI();

        // Resume auto spin if it was active, or start free spins
        if (wasAutoSpin) {
          state.autoSpin = true;
          DOM.autoBtn.classList.add('active');
        }
        setTimeout(() => spin(), 600);
      }, 1500);
    };

    cards.forEach(c => c.addEventListener('click', handleChoice));
  }

  function closeBonusOverlay() {
    DOM.bonusOverlay.classList.remove('active');
  }

  function spawnBonusParticles() {
    const colors = ['#ffd700', '#a855f7', '#00d4ff', '#ff4d6d', '#22c55e', '#fff'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'bonus-particle';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 3 + Math.random() * 5;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.background = color;
        p.style.boxShadow = `0 0 ${size * 2}px ${color}`;
        p.style.left = `${cx}px`;
        p.style.top = `${cy - 60}px`;

        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 250;
        p.style.setProperty('--bpx', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--bpy', `${Math.sin(angle) * dist}px`);

        document.body.appendChild(p);
        setTimeout(() => p.remove(), 2000);
      }, i * 30);
    }
  }

  // ─── Init ───
  function init() {
    createParticles();
    buildPaytable();
    initGrid();
    updateUI();
    animateJackpot();
    initAudioControls();
  }

  init();
})();
