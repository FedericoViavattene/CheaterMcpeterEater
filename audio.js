/* ═══════════════════════════════════════════
   MEGA SLOTS — Audio Engine
   Procedural sounds via Web Audio API
   ═══════════════════════════════════════════ */

const AudioEngine = (() => {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicPlaying = false;
  let musicNodes = [];
  let initialized = false;

  // Volume levels
  let masterVol = 0.6;
  let musicVol = 0.25;
  let sfxVol = 0.7;

  // ─── Initialize Audio Context (must be called from user gesture) ───
  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = masterVol;
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = musicVol;
      musicGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = sfxVol;
      sfxGain.connect(masterGain);

      initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ─── Utility: Play a note ───
  function playTone(freq, type, duration, gainNode, volume = 0.3, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(gainNode);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // ─── Utility: Noise burst ───
  function playNoise(duration, gainNode, volume = 0.1, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Bandpass filter for more pleasant noise
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1.5;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(gainNode);
    source.start(t);
  }

  // ═══════════════════════════════════════════
  // SOUND EFFECTS
  // ═══════════════════════════════════════════

  // ─── Spin Start: Whoosh + mechanical lever ───
  function spinStart() {
    if (!ctx) return;
    resume();

    // Lever pull sound — descending sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);

    // Click
    playNoise(0.05, sfxGain, 0.2, 0.0);
  }

  // ─── Reel Tick: Quick click while spinning ───
  let tickInterval = null;
  let tickSpeed = 60;

  function startReelTicks() {
    if (!ctx) return;
    stopReelTicks();
    tickSpeed = 60;

    tickInterval = setInterval(() => {
      playTone(800 + Math.random() * 400, 'square', 0.02, sfxGain, 0.06);
      // Slow down ticks gradually
      tickSpeed = Math.min(tickSpeed + 2, 250);
      clearInterval(tickInterval);
      tickInterval = setInterval(arguments.callee, tickSpeed);
    }, tickSpeed);

    // Safety: auto-stop after 5s
    setTimeout(stopReelTicks, 5000);
  }

  // Simpler approach: schedule ticks
  let tickTimeouts = [];

  function startReelTicksScheduled(durationMs) {
    if (!ctx) return;
    stopReelTicks();
    tickTimeouts = [];

    const totalTicks = 40;
    for (let i = 0; i < totalTicks; i++) {
      // Ease-out timing: ticks get slower toward the end
      const progress = i / totalTicks;
      const eased = 1 - Math.pow(1 - progress, 2);
      const time = eased * durationMs;

      const tid = setTimeout(() => {
        const freq = 600 + Math.random() * 600;
        playTone(freq, 'square', 0.015, sfxGain, 0.05);
      }, time);
      tickTimeouts.push(tid);
    }
  }

  function stopReelTicks() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    tickTimeouts.forEach(t => clearTimeout(t));
    tickTimeouts = [];
  }

  // ─── Reel Stop: Satisfying thud ───
  function reelStop(reelIndex) {
    if (!ctx) return;
    const delay = 0;
    // Low thud
    playTone(80 + reelIndex * 10, 'sine', 0.12, sfxGain, 0.2, delay);
    // High click
    playTone(2000, 'square', 0.02, sfxGain, 0.08, delay);
    // Noise thud
    playNoise(0.06, sfxGain, 0.12, delay);
  }

  // ─── Line Win: Rising chime ───
  function lineWin() {
    if (!ctx) return;
    resume();

    // Happy ascending arpeggio
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      playTone(freq, 'sine', 0.25, sfxGain, 0.18, i * 0.08);
      playTone(freq * 1.5, 'triangle', 0.2, sfxGain, 0.06, i * 0.08);
    });

    // Sparkle noise
    playNoise(0.15, sfxGain, 0.08, 0.3);
  }

  // ─── Small Win: Quick coin sound ───
  function smallWin() {
    if (!ctx) return;
    resume();

    // Coin ding
    playTone(1200, 'sine', 0.15, sfxGain, 0.2);
    playTone(1500, 'sine', 0.12, sfxGain, 0.15, 0.06);
    playTone(1800, 'triangle', 0.15, sfxGain, 0.1, 0.1);
  }

  // ─── Big Win (≥20x): Fanfare ───
  function bigWin() {
    if (!ctx) return;
    resume();

    // Triumphant fanfare chord progression
    const fanfare = [
      // Chord 1: C major
      { notes: [523, 659, 784], time: 0, dur: 0.4 },
      // Chord 2: F major
      { notes: [698, 880, 1047], time: 0.35, dur: 0.4 },
      // Chord 3: G major
      { notes: [784, 988, 1175], time: 0.7, dur: 0.4 },
      // Chord 4: C major (octave up)
      { notes: [1047, 1319, 1568], time: 1.05, dur: 0.7 },
    ];

    fanfare.forEach(chord => {
      chord.notes.forEach((freq, i) => {
        playTone(freq, 'sine', chord.dur, sfxGain, 0.12, chord.time);
        playTone(freq, 'triangle', chord.dur * 0.8, sfxGain, 0.06, chord.time);
      });
    });

    // Sparkle cascades
    for (let i = 0; i < 8; i++) {
      const freq = 2000 + Math.random() * 3000;
      playTone(freq, 'sine', 0.08, sfxGain, 0.04, 0.2 + i * 0.15);
    }

    // Rising sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(3000, t + 1.5);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.setValueAtTime(0.06, t + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 2);
  }

  // ─── Mega Win / Jackpot ───
  function megaWin() {
    if (!ctx) return;
    resume();

    // Epic escalating fanfare
    const melody = [
      523, 587, 659, 698, 784, 880, 988, 1047,
      1175, 1319, 1397, 1568, 1760, 1976, 2093
    ];

    melody.forEach((freq, i) => {
      playTone(freq, 'sine', 0.2, sfxGain, 0.12, i * 0.07);
      playTone(freq * 0.5, 'triangle', 0.25, sfxGain, 0.06, i * 0.07);
    });

    // Big sparkle burst at end
    for (let i = 0; i < 15; i++) {
      const freq = 1500 + Math.random() * 4000;
      playTone(freq, 'sine', 0.1, sfxGain, 0.05, 1.0 + i * 0.06);
    }

    // Bass boom
    playTone(60, 'sine', 0.8, sfxGain, 0.25, 0);
    playNoise(0.3, sfxGain, 0.15, 1.0);
  }

  // ─── Coin Drop ───
  function coinDrop() {
    if (!ctx) return;
    const freq = 2000 + Math.random() * 2000;
    playTone(freq, 'sine', 0.06, sfxGain, 0.08);
  }

  // ─── Button Click ───
  function buttonClick() {
    if (!ctx) return;
    resume();
    playTone(600, 'square', 0.03, sfxGain, 0.08);
    playTone(800, 'square', 0.02, sfxGain, 0.05, 0.02);
  }

  // ─── Free Spins Awarded ───
  function freeSpinsAwarded() {
    if (!ctx) return;
    resume();

    // Magical ascending scale
    const scale = [440, 554, 659, 880, 1047, 1319, 1760];
    scale.forEach((freq, i) => {
      playTone(freq, 'sine', 0.3, sfxGain, 0.12, i * 0.1);
      playTone(freq * 2, 'triangle', 0.2, sfxGain, 0.04, i * 0.1 + 0.05);
    });

    // Shimmer
    for (let i = 0; i < 10; i++) {
      playTone(3000 + Math.random() * 2000, 'sine', 0.05, sfxGain, 0.03, 0.5 + i * 0.08);
    }
  }

  // ─── Insufficient Balance ───
  function errorSound() {
    if (!ctx) return;
    resume();
    playTone(300, 'square', 0.15, sfxGain, 0.12);
    playTone(200, 'square', 0.2, sfxGain, 0.1, 0.12);
  }

  // ═══════════════════════════════════════════
  // BACKGROUND MUSIC — Ambient casino loop
  // ═══════════════════════════════════════════

  function startMusic() {
    if (!ctx || musicPlaying) return;
    resume();
    musicPlaying = true;

    // Create a chill looping ambient track
    playMusicLoop();
  }

  function playMusicLoop() {
    if (!ctx || !musicPlaying) return;

    const t = ctx.currentTime;
    const barDuration = 4; // 4 seconds per bar
    const totalBars = 4;
    const loopDuration = barDuration * totalBars;

    // ─── Bass line (smooth sine pad) ───
    const bassNotes = [
      { freq: 65, time: 0 },
      { freq: 73, time: barDuration },
      { freq: 82, time: barDuration * 2 },
      { freq: 73, time: barDuration * 3 },
    ];

    bassNotes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0, t + note.time);
      gain.gain.linearRampToValueAtTime(0.12, t + note.time + 0.3);
      gain.gain.setValueAtTime(0.12, t + note.time + barDuration - 0.3);
      gain.gain.linearRampToValueAtTime(0, t + note.time + barDuration);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t + note.time);
      osc.stop(t + note.time + barDuration + 0.1);
      musicNodes.push(osc);
    });

    // ─── Pad chords (warm triangle waves) ───
    const chords = [
      { notes: [130, 164, 196], time: 0 },
      { notes: [146, 185, 220], time: barDuration },
      { notes: [164, 207, 247], time: barDuration * 2 },
      { notes: [146, 185, 220], time: barDuration * 3 },
    ];

    chords.forEach(chord => {
      chord.notes.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        // Slow tremolo
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.3 + Math.random() * 0.3;
        lfoGain.gain.value = 0.015;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start(t + chord.time);
        lfo.stop(t + chord.time + barDuration + 0.1);

        gain.gain.setValueAtTime(0, t + chord.time);
        gain.gain.linearRampToValueAtTime(0.04, t + chord.time + 0.8);
        gain.gain.setValueAtTime(0.04, t + chord.time + barDuration - 0.8);
        gain.gain.linearRampToValueAtTime(0, t + chord.time + barDuration);

        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t + chord.time);
        osc.stop(t + chord.time + barDuration + 0.1);
        musicNodes.push(osc);
      });
    });

    // ─── Sparkle arpeggios (subtle high notes) ───
    for (let bar = 0; bar < totalBars; bar++) {
      const baseTime = bar * barDuration;
      const arpeggioNotes = [523, 659, 784, 1047, 784, 659];
      arpeggioNotes.forEach((freq, i) => {
        const noteTime = baseTime + i * 0.55;
        if (noteTime < loopDuration) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t + noteTime);
          gain.gain.linearRampToValueAtTime(0.02, t + noteTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + noteTime + 0.5);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(t + noteTime);
          osc.stop(t + noteTime + 0.55);
          musicNodes.push(osc);
        }
      });
    }

    // Schedule next loop
    const loopTimer = setTimeout(() => {
      musicNodes = [];
      if (musicPlaying) playMusicLoop();
    }, loopDuration * 1000 - 100);

    musicNodes._loopTimer = loopTimer;
  }

  function stopMusic() {
    musicPlaying = false;
    musicNodes.forEach(node => {
      try { node.stop(); } catch (e) { /* already stopped */ }
    });
    if (musicNodes._loopTimer) clearTimeout(musicNodes._loopTimer);
    musicNodes = [];
  }

  function toggleMusic() {
    if (musicPlaying) {
      stopMusic();
    } else {
      startMusic();
    }
    return musicPlaying;
  }

  // ═══════════════════════════════════════════
  // VOLUME CONTROLS
  // ═══════════════════════════════════════════

  function setMasterVolume(val) {
    masterVol = Math.max(0, Math.min(1, val));
    if (masterGain) masterGain.gain.value = masterVol;
  }

  function setMusicVolume(val) {
    musicVol = Math.max(0, Math.min(1, val));
    if (musicGain) musicGain.gain.value = musicVol;
  }

  function setSfxVolume(val) {
    sfxVol = Math.max(0, Math.min(1, val));
    if (sfxGain) sfxGain.gain.value = sfxVol;
  }

  function toggleMute() {
    if (masterGain) {
      if (masterGain.gain.value > 0) {
        masterGain.gain.value = 0;
        return true; // now muted
      } else {
        masterGain.gain.value = masterVol;
        return false; // unmuted
      }
    }
  }

  // ═══════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════

  return {
    init,
    resume,
    // SFX
    spinStart,
    startReelTicks: startReelTicksScheduled,
    stopReelTicks,
    reelStop,
    lineWin,
    smallWin,
    bigWin,
    megaWin,
    coinDrop,
    buttonClick,
    freeSpinsAwarded,
    errorSound,
    // Music
    startMusic,
    stopMusic,
    toggleMusic,
    // Volume
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    toggleMute,
    // State
    get isMusicPlaying() { return musicPlaying; },
    get isInitialized() { return initialized; },
  };
})();
