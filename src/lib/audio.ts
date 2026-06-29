/**
 * Audio effects engine using Web Audio API
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a satisfying, sweet dual-note chime when a task is completed.
 */
export function playCompletionSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First note: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second note: G#5 (830.61 Hz) after a tiny delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(830.61, now + 0.08);
    
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);

    // Third note: B5 (987.77 Hz) after another tiny delay for a major chord feel
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(987.77, now + 0.16);
    
    gain3.gain.setValueAtTime(0, now + 0.16);
    gain3.gain.linearRampToValueAtTime(0.12, now + 0.20);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc3.start(now + 0.16);
    osc3.stop(now + 0.8);
  } catch (error) {
    console.warn("Audio Context blocked or failed to initialize:", error);
  }
}

/**
 * Plays a rich, resonant gong/bell sound when a timer session ends.
 */
export function playTimerEndSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // We combine multiple frequencies to create a rich, complex bell sound
    const frequencies = [220, 440, 554.37, 659.25, 880]; // A major 7 harmony frequencies
    const gains = [0.15, 0.1, 0.08, 0.06, 0.04];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = idx === 0 ? "triangle" : "sine"; // Warm base fundamental
      osc.frequency.setValueAtTime(freq, now);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gains[idx], now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.8 - (idx * 0.2));
      
      osc.start(now);
      osc.stop(now + 1.8);
    });
  } catch (error) {
    console.warn("Audio Context blocked or failed to initialize:", error);
  }
}

/**
 * Plays an alarm chime sound to notify that it's time to begin a task.
 */
export function playTaskStartAlarmSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two rapid high-pitched repeating notes for active alerting
    const playNote = (timeOffset: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + timeOffset);
      
      gainNode.gain.setValueAtTime(0, now + timeOffset);
      gainNode.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + duration);
      
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + duration);
    };

    // A beautiful notification chime: C5 (523.25), E5 (659.25), G5 (783.99)
    playNote(0, 523.25, 0.35);
    playNote(0.12, 659.25, 0.35);
    playNote(0.24, 783.99, 0.5);
    playNote(0.48, 1046.50, 0.6); // Double C octaves
  } catch (error) {
    console.warn("Audio Context blocked or failed to initialize:", error);
  }
}

/**
 * Plays an urgent repeating digital alarm beeping sound for overdue tasks.
 */
export function playOverdueUrgentAlarmSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const playBeep = (timeOffset: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = "sawtooth"; // buzzier, more urgent waveform
      osc.frequency.setValueAtTime(freq, now + timeOffset);
      
      gainNode.gain.setValueAtTime(0, now + timeOffset);
      gainNode.gain.linearRampToValueAtTime(0.08, now + timeOffset + 0.02);
      gainNode.gain.setValueAtTime(0.08, now + timeOffset + 0.12);
      gainNode.gain.linearRampToValueAtTime(0, now + timeOffset + 0.15);
      
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.16);
    };

    // Urgent double pulse: Beep Beep! (A5: 880Hz)
    playBeep(0, 880);
    playBeep(0.2, 880);
    
    // Higher pitched sub-octave tone layered
    playBeep(0.4, 1174.66); // D6
    playBeep(0.6, 1174.66);
  } catch (error) {
    console.warn("Audio Context blocked or failed to initialize:", error);
  }
}

// Persistent Looping Alarm State
let alarmIntervalId: any = null;
let currentLoopType: 'start' | 'overdue' | null = null;

/**
 * Starts a looping, continuous alarm sound.
 * - 'start': A pleasant but persistent chiming clock alarm repeating every 2.0s.
 * - 'overdue': A high-tension urgent sirens/beeping alarm repeating every 0.8s.
 */
export function startLoopingAlarm(type: 'start' | 'overdue') {
  try {
    const ctx = getAudioContext();
    
    // If we're already running this exact type, no need to restart
    if (alarmIntervalId && currentLoopType === type) {
      return;
    }

    // Stop current active loop first
    stopLoopingAlarm();
    currentLoopType = type;

    const playAlarmTick = () => {
      // Ensure context is running (user interaction might have activated it)
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const now = ctx.currentTime;

      if (type === 'start') {
        // Continuous Start Chime Chord: soothing, warm major bell tones
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major chord tones
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);
          
          gainNode.gain.setValueAtTime(0, now + idx * 0.15);
          gainNode.gain.linearRampToValueAtTime(0.03, now + idx * 0.15 + 0.08); // Softer volume (0.03)
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
          
          osc.start(now + idx * 0.15);
          osc.stop(now + 1.9);
        });
      } else {
        // Soft & Soothing yet persistent Overdue Alarm: warm, meditative minor arpeggio
        // Designed to be pleasant to listen to for a long time, like Zen focus bells
        const freqs = [293.66, 349.23, 440.00, 587.33]; // D Minor chord tones (soft, meditative)
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          // Pure sine wave for a clean, non-grating fluid tone
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          
          gainNode.gain.setValueAtTime(0, now + idx * 0.12);
          // Very gentle ramp up to avoid sudden clicks, low volume (0.04)
          gainNode.gain.linearRampToValueAtTime(0.04, now + idx * 0.12 + 0.12);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          
          osc.start(now + idx * 0.12);
          osc.stop(now + 1.6);
        });
      }
    };

    // Play immediate first tick
    playAlarmTick();

    // Setup periodic repetition (overdue ticks faster and is more intense)
    const tickInterval = type === 'overdue' ? 900 : 2200;
    alarmIntervalId = setInterval(playAlarmTick, tickInterval);
  } catch (error) {
    console.warn("Could not start looping alarm:", error);
  }
}

/**
 * Stops any active looping alarm.
 */
export function stopLoopingAlarm() {
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  currentLoopType = null;
}



