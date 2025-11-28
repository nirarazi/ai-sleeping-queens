import attackSound from '../assets/sounds/attack.mp3';
import catSound from '../assets/sounds/cat.mp3';
import clownSound from '../assets/sounds/clown.mp3';
import countdownSound from '../assets/sounds/countdown.mp3';
import disposeSound from '../assets/sounds/dispose.mp3';
import dogSound from '../assets/sounds/dog.mp3';
import dragonSound from '../assets/sounds/dragon.mp3';
import kingSound from '../assets/sounds/king.mp3';
import knightSound from '../assets/sounds/knight.mp3';
// import loopSound from '../assets/sounds/loop.mp3';
import potionSound from '../assets/sounds/potion.mp3';
import sleepSound from '../assets/sounds/sleep.mp3';
import turnSound from '../assets/sounds/turn.wav';
import wakeSound from '../assets/sounds/wake.wav';
import wandSound from '../assets/sounds/wand.mp3';
import winSound from '../assets/sounds/win.mp3';

export class SoundManager {
  private sounds: Record<string, HTMLAudioElement> = {};
  private muted: boolean = false;

  constructor() {
    this.preloadSounds();
  }

  private preloadSounds() {
    const soundMap: Record<string, string> = {
      attack: attackSound,
      cat: catSound,
      clown: clownSound,
      countdown: countdownSound,
      dispose: disposeSound,
      dog: dogSound,
      dragon: dragonSound,
      king: kingSound,
      knight: knightSound,
      potion: potionSound,
      sleep: sleepSound,
      turn: turnSound,
      wake: wakeSound,
      wand: wandSound,
      win: winSound,
    };

    for (const [key, src] of Object.entries(soundMap)) {
      this.sounds[key] = new Audio(src);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  private play(key: string) {
    if (this.muted) return;
    const audio = this.sounds[key];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn(`Failed to play sound ${key}:`, e));
    }
  }

  playTurnNotification() {
    this.play('turn');
  }

  playWin() {
    this.play('win');
  }

  playGameStart() {
    this.play('countdown');
  }

  playAttack() {
      this.play('attack');
  }

  playQueenWake(queenName: string) {
      if (queenName.toLowerCase().includes('cat')) {
          this.play('cat');
      } else if (queenName.toLowerCase().includes('dog')) {
          this.play('dog');
      } else {
          this.play('wake');
      }
  }

  playQueenSleep() {
      this.play('sleep');
  }

  playCardSound(type: string) {
      switch (type) {
          case 'KING':
              this.play('king');
              break;
          case 'KNIGHT':
              this.play('knight');
              break;
          case 'DRAGON':
              this.play('dragon');
              break;
          case 'POTION':
              this.play('potion');
              break;
          case 'WAND':
              this.play('wand');
              break;
          case 'JESTER':
              this.play('clown');
              break;
          case 'NUMBER':
          default:
              this.play('dispose');
              break;
      }
  }

  playTick() {
    if (this.muted) return;
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        // High pitch short beep
        osc.frequency.value = 1000; 
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.warn("AudioContext error", e);
    }
  }
}

export const soundManager = new SoundManager();
