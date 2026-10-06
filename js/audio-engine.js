// =============================================================================
// SILNIK AUDIO - tony kontrolne, identyfikacja kanałów, szum, piki synchronizacji
//
// Poziomy w dBFS odnoszą się do sinusa pełnej skali (AES17): -18 dBFS = EBU R 68,
// -20 dBFS = SMPTE RP 155. Szum różowy kalibrowany jest wartością skuteczną (RMS).
//
// Zdarzenia (przerwy identyfikacji, piki synchronizacji) planowane są z wyprzedzeniem
// na zegarze AudioContext - dzięki temu są dokładne co do próbki niezależnie od
// obciążenia strony. Piki synchronizacji wypadają w wielokrotnościach okresu
// czasu AudioContext, a część wizyjna (av-sync.js) odczytuje ten sam zegar przez
// getAudioTime() - obraz i dźwięk mają wspólną podstawę czasu.
// =============================================================================

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.merger = null;
        this.nodes = [];
        this.scheduler = null;
        this.nextEventTime = 0;
        this.muted = false;
        this.config = {
            mode: 'off',
            freq: 1000,
            level: -18,
            channels: 'lr',
            syncPeriod: 2,
            syncDuration: 200
        };

        // Odwzorowanie czasu przeglądarki -> czas AudioContext słyszany w głośniku
        this.clockOffset = null;
        this.timebase = 'performance';

        this.RAMP = 0.001;          // narastanie / opadanie zboczy (bez trzasków)
        this.LOOKAHEAD = 0.5;       // planowanie zdarzeń z wyprzedzeniem [s]
    }

    init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn('Przeglądarka nie obsługuje Web Audio API');
            return;
        }
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.merger = this.ctx.createChannelMerger(2);
        this.merger.connect(this.master);
        this.master.connect(this.ctx.destination);

        this.ctx.addEventListener?.('statechange', () => {
            this.clockOffset = null;
            if (this.isRunning()) this.rebuild();
        });
    }

    isRunning() {
        return !!this.ctx && this.ctx.state === 'running';
    }

    // Musi zostać wywołane w obsłudze gestu użytkownika (polityka autoodtwarzania)
    resume() {
        if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
            return this.ctx.resume();
        }
        return Promise.resolve();
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) {
            this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
        }
    }

    setConfig(partial) {
        const prev = JSON.stringify(this.config);
        Object.assign(this.config, partial);
        if (JSON.stringify(this.config) !== prev) {
            this.rebuild();
        }
    }

    amplitude() {
        return Math.pow(10, this.config.level / 20);
    }

    // Wzmocnienia kanałów L/R dla wybranego trybu
    channelGains(a) {
        switch (this.config.channels) {
            case 'l': return [a, 0];
            case 'r': return [0, a];
            case 'anti': return [a, -a];
            default: return [a, a];
        }
    }

    stopAll() {
        if (this.scheduler) {
            clearInterval(this.scheduler);
            this.scheduler = null;
        }
        for (const node of this.nodes) {
            try { node.stop?.(); } catch (e) { /* już zatrzymany */ }
            try { node.disconnect(); } catch (e) { /* już odłączony */ }
        }
        this.nodes = [];
    }

    // Źródło -> [bramka] -> wzmocnienia L/R -> merger
    connectStereo(source, gains) {
        const out = [];
        gains.forEach((g, ch) => {
            const gain = this.ctx.createGain();
            gain.gain.value = g;
            source.connect(gain);
            gain.connect(this.merger, 0, ch);
            out.push(gain);
            this.nodes.push(gain);
        });
        return out;
    }

    createOscillator() {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = this.config.freq;
        osc.start();
        this.nodes.push(osc);
        return osc;
    }

    rebuild() {
        if (!this.ctx) return;
        this.stopAll();
        const mode = this.config.mode;
        const a = this.amplitude();

        if (mode === 'tone') {
            this.connectStereo(this.createOscillator(), this.channelGains(a));
        } else if (mode === 'pink') {
            const src = this.ctx.createBufferSource();
            src.buffer = this.pinkNoiseBuffer();
            src.loop = true;
            src.start();
            this.nodes.push(src);
            this.connectStereo(src, this.channelGains(a));
        } else if (AudioEngine.IDENTS[mode]) {
            const gains = this.connectStereo(this.createOscillator(), [a, a]);
            const ident = AudioEngine.IDENTS[mode];
            this.startScheduler(ident.cycle, (t) => {
                for (const gap of ident.gaps) {
                    this.gate(gains[gap.ch].gain, a, t + gap.start, t + gap.start + gap.dur);
                }
            });
        } else if (mode === 'sync') {
            const gate = this.ctx.createGain();
            gate.gain.value = 0;
            this.createOscillator().connect(gate);
            this.nodes.push(gate);
            this.connectStereo(gate, this.channelGains(a));
            const dur = this.config.syncDuration / 1000;
            this.startScheduler(this.config.syncPeriod, (t) => {
                const p = gate.gain;
                p.setValueAtTime(0, t);
                p.linearRampToValueAtTime(1, t + this.RAMP);
                p.setValueAtTime(1, t + dur);
                p.linearRampToValueAtTime(0, t + dur + this.RAMP);
            });
        }
    }

    // Przerwa w sygnale: wyciszenie od tOff do tOn
    gate(param, a, tOff, tOn) {
        param.setValueAtTime(a, tOff);
        param.linearRampToValueAtTime(0, tOff + this.RAMP);
        param.setValueAtTime(0, tOn);
        param.linearRampToValueAtTime(a, tOn + this.RAMP);
    }

    // Zdarzenia co `period` sekund, wyrównane do wielokrotności okresu zegara audio
    startScheduler(period, scheduleAt) {
        this.nextEventTime = Math.ceil((this.ctx.currentTime + 0.05) / period) * period;
        const tick = () => {
            while (this.nextEventTime < this.ctx.currentTime + this.LOOKAHEAD) {
                scheduleAt(this.nextEventTime);
                this.nextEventTime += period;
            }
        };
        tick();
        this.scheduler = setInterval(tick, 50);
    }

    // Szum różowy (filtr Paula Kelleta), 10 s w pętli, RMS = sinus pełnej skali
    pinkNoiseBuffer() {
        if (this.pinkBuffer && this.pinkBuffer.sampleRate === this.ctx.sampleRate) {
            return this.pinkBuffer;
        }
        const length = this.ctx.sampleRate * 10;
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        let sumSq = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;
            data[i] = pink;
            sumSq += pink * pink;
        }
        const scale = Math.SQRT1_2 / Math.sqrt(sumSq / length);
        for (let i = 0; i < length; i++) data[i] *= scale;
        this.pinkBuffer = buffer;
        return buffer;
    }

    // -------------------------------------------------------------------------
    // Wspólna podstawa czasu dla obrazu i dźwięku
    // Zwraca czas AudioContext [s], który w chwili perfMs (performance.now())
    // jest odtwarzany przez urządzenie wyjściowe. Bez działającego audio -
    // zegar przeglądarki (obraz działa, ale bez odniesienia do dźwięku).
    // -------------------------------------------------------------------------
    getAudioTime(perfMs) {
        if (!this.isRunning()) {
            this.timebase = 'performance';
            this.clockOffset = null;
            return perfMs / 1000;
        }

        let offset = null;
        if (this.ctx.getOutputTimestamp) {
            const ts = this.ctx.getOutputTimestamp();
            if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
                offset = ts.contextTime - ts.performanceTime / 1000;
                this.timebase = 'outputTimestamp';
            }
        }
        if (offset === null) {
            const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
            offset = this.ctx.currentTime - latency - performance.now() / 1000;
            this.timebase = 'currentTime';
        }

        // Wygładzenie (zegar audio aktualizuje się blokami po kilka ms)
        if (this.clockOffset === null || Math.abs(offset - this.clockOffset) > 0.03) {
            this.clockOffset = offset;
        } else {
            this.clockOffset += (offset - this.clockOffset) * 0.05;
        }
        return perfMs / 1000 + this.clockOffset;
    }

    latencyInfo() {
        if (!this.ctx) return null;
        return {
            sampleRate: this.ctx.sampleRate,
            baseLatency: this.ctx.baseLatency,
            outputLatency: this.ctx.outputLatency,
            timebase: this.timebase,
            state: this.ctx.state
        };
    }

    // Opis sygnału do wyświetlenia na planszy
    describe() {
        const c = this.config;
        const f = c.freq >= 1000 && c.freq % 1000 === 0 ? `${c.freq / 1000} kHz` : `${c.freq} Hz`;
        const lvl = `${c.level < 0 ? '−' : ''}${Math.abs(c.level)} dBFS`;
        const ch = { lr: 'L+R', l: 'tylko L', r: 'tylko P', anti: 'L+R antyfaza' }[c.channels];
        switch (c.mode) {
            case 'tone': return `${f}  ${lvl}  ${ch}`;
            case 'ebu': return `EBU IDENT  ${f}  ${lvl}`;
            case 'glits': return `GLITS  ${f}  ${lvl}`;
            case 'pink': return `SZUM RÓŻOWY  ${lvl} RMS  ${ch}`;
            case 'sync': return `A/V SYNC  ${f}  ${lvl}  ${c.syncDuration} ms / ${c.syncPeriod} s`;
            default: return '';
        }
    }
}

// Sekwencje identyfikacji kanałów - przerwy w tonie [s] względem początku cyklu
// (ch: 0 = lewy, 1 = prawy). Cykle wypadają w wielokrotnościach długości cyklu
// zegara audio - z tej samej tabeli korzysta wskaźnik graficzny (ident-indicator.js).
// - EBU (Tech 3304): przerwa 250 ms tylko w lewym kanale co 3 s
// - GLITS (BBC): lewy raz, prawy dwukrotnie (250 ms po lewym, odstęp 250 ms) co 4 s
AudioEngine.IDENTS = {
    ebu: {
        name: 'EBU',
        cycle: 3,
        gaps: [{ ch: 0, start: 0, dur: 0.25 }]
    },
    glits: {
        name: 'GLITS',
        cycle: 4,
        gaps: [
            { ch: 0, start: 0, dur: 0.25 },
            { ch: 1, start: 0.5, dur: 0.25 },
            { ch: 1, start: 1.0, dur: 0.25 }
        ]
    }
};

window.AudioEngine = AudioEngine;
