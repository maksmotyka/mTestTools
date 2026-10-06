// =============================================================================
// AUTOMATYCZNY TEST STEREO - część wizyjna
// Sekwencja kroków i czasy pochodzą z AudioEngine.stereoTiming(), a bieżący krok wyznaczany
// jest z zegara audio (jak przy synchronizacji A/V). Wskazania mierników,
// korelacji i goniometru liczone są z faktycznie generowanego sygnału (AnalyserNode):
//  - MIERNIKI L / P   - wartość szczytowa w dBFS, szybkie opadanie (60 dB/s) - wskazanie
//                       gaśnie w przerwie między krokami,
//                       znacznik poziomu odniesienia -18 dBFS (EBU R 68),
//                       oraz wartość skuteczna (RMS) w dBFS odniesionych do sinusa -
//                       szum -18 dBFS RMS ma szczyty ok. 7-8 dB wyżej,
//  - KORELACJA        - +1 (0°) sygnał mono, 0 (90°) kanały niezależne / jeden kanał,
//                       -1 (180°) przeciwfaza - sygnał zaniknie po zsumowaniu do mono,
//  - GONIOMETR        - obraz stereo: pion = M (L+P), poziom = S (L−P);
//                       sam lewy kanał - przekątna "\", sam prawy - "/",
//                       mono - linia pionowa, przeciwfaza - linia pozioma.
// =============================================================================

class StereoTestOverlay {
    constructor(audio) {
        this.audio = audio;
        this.meters = [this.newMeter(), this.newMeter()];
        this.correlation = 0;
        this.lastTs = 0;
        this.gonio = document.createElement('canvas');

        this.DB_MIN = -60;
        this.REF = -18;          // poziom odniesienia (EBU R 68)
        this.HIGH = -9;          // maksymalny poziom dopuszczalny (EBU R 68)
        this.FALL = 60;          // opadanie wskazania [dB/s] - od -11 do dna skali w ok. 0,8 s
        this.HOLD = 1;           // podtrzymanie szczytu [s]
    }

    newMeter() {
        return { db: -Infinity, peak: -Infinity, peakTime: 0, rms: 0 };
    }

    // Wysokość panelu - także dla rozmieszczenia napisów (overlay.js)
    static panelSize(w, h) {
        const pw = Math.min(w * 0.84, h * 1.2);
        return { pw, ph: pw * 0.55 };
    }

    static mod(a, n) {
        return ((a % n) + n) % n;
    }

    // Bieżący krok sekwencji dla klatki prezentowanej w chwili displayPerfMs
    state(displayPerfMs, cfg) {
        const test = this.audio.stereoTiming();
        const t = this.audio.getAudioTime(displayPerfMs) - cfg.syncOffset / 1000;
        const phase = StereoTestOverlay.mod(t, test.cycle);
        const index = Math.min(test.steps.length - 1, Math.floor(phase / test.stepDur));
        const within = phase - index * test.stepDur;
        return {
            index,
            step: test.steps[index],
            progress: within / test.stepDur,
            active: within < test.signal
        };
    }

    // Pomiar: szczyt w dBFS (sinus pełnej skali = 0 dBFS) i korelacja kanałów
    measure(ts) {
        const dt = this.lastTs ? Math.min(0.2, (ts - this.lastTs) / 1000) : 0;
        this.lastTs = ts;
        const samples = this.audio.getSamples();
        const peaks = [0, 0];
        let sLR = 0, sLL = 0, sRR = 0;
        if (samples && this.audio.isRunning()) {
            const [L, R] = samples;
            for (let i = 0; i < L.length; i++) {
                const l = L[i], r = R[i];
                if (Math.abs(l) > peaks[0]) peaks[0] = Math.abs(l);
                if (Math.abs(r) > peaks[1]) peaks[1] = Math.abs(r);
                sLR += l * r; sLL += l * l; sRR += r * r;
            }
        }

        const now = ts / 1000;
        const n = samples ? samples[0].length : 1;
        const energy = [sLL, sRR];
        this.meters.forEach((m, ch) => {
            // RMS (średnia kwadratów wygładzana ok. 300 ms), +3 dB - odniesienie do sinusa
            // Zanik sygnału (spadek o ponad 30 dB) - bez uśredniania, odczyt gaśnie od razu
            const power = energy[ch] / n;
            m.rms = power < m.rms * 1e-3 ? power : m.rms + (power - m.rms) * Math.min(1, dt * 3.3);
            m.rmsDb = m.rms > 1e-12 ? 10 * Math.log10(m.rms * 2) : -Infinity;
            const db = peaks[ch] > 0 ? 20 * Math.log10(peaks[ch]) : -Infinity;
            m.db = db >= m.db ? db : Math.max(db, m.db - this.FALL * dt);
            if (db >= m.peak || now - m.peakTime > this.HOLD) {
                m.peak = db;
                m.peakTime = now;
            }
        });

        // Korelacja tylko, gdy oba kanały niosą sygnał (powyżej -70 dBFS RMS)
        const floor = n * Math.pow(10, -70 / 10);
        const target = sLL > floor && sRR > floor ? sLR / Math.sqrt(sLL * sRR) : 0;
        this.correlation += (target - this.correlation) * Math.min(1, dt * 8);
        this.bothChannels = sLL > floor && sRR > floor;
        return samples;
    }

    draw(ctx, w, h, rafTs, frameMs, cfg) {
        const samples = this.measure(rafTs);
        const s = this.state(rafTs + frameMs, cfg);
        const { pw, ph } = StereoTestOverlay.panelSize(w, h);
        const px = (w - pw) / 2, py = (h - ph) / 2;
        const u = ph / 100;
        const PW = pw / u;                       // szerokość panelu w jednostkach
        const X = (v) => px + v * u, Y = (v) => py + v * u;

        ctx.fillStyle = 'rgba(40, 40, 40, 0.94)';
        this.roundRect(ctx, px, py, pw, ph, u * 3);
        ctx.fill();

        // Mierniki po bokach
        this.drawMeter(ctx, X(6), Y(12), u * 7, u * 76, this.meters[0], 'L', u, 'right');
        this.drawMeter(ctx, X(PW - 13), Y(12), u * 7, u * 76, this.meters[1], 'P', u, 'left');

        // Tytuł bieżącego kroku i pasek postępu
        const freq = this.audio.config.freq;
        const srcName = s.step.src === 'tone'
            ? `TON ${freq >= 1000 && freq % 1000 === 0 ? freq / 1000 + ' kHz' : freq + ' Hz'}`
            : 'SZUM RÓŻOWY';
        const titleColor = s.active ? 'rgb(255, 215, 60)' : '#888';
        this.text(ctx, srcName, X(PW / 2), Y(8), u * 7, titleColor, 'center');
        this.text(ctx, s.active ? s.step.name : 'PRZERWA', X(PW / 2), Y(16.5), u * 6, titleColor, 'center');
        ctx.fillStyle = '#555';
        ctx.fillRect(X(26), Y(22), (PW - 52) * u, u * 0.8);
        ctx.fillStyle = titleColor;
        ctx.fillRect(X(26), Y(22), (PW - 52) * u * s.progress, u * 0.8);

        // Goniometr
        this.drawGoniometer(ctx, X(26), Y(27), u * 52, samples, u);

        // Lista kroków
        const lx = 84;
        const test = AudioEngine.STEREO_TEST;
        ['tone', 'noise'].forEach((src, row) => {
            const y = 29 + row * 10;
            this.text(ctx, src === 'tone' ? 'TON' : 'SZUM', X(lx), Y(y + 4), u * 4, '#bbb', 'left');
            test.steps.filter(st => st.src === src).forEach((st, i) => {
                const idx = test.steps.indexOf(st);
                const bx = lx + 14 + i * 11.8;
                const current = idx === s.index;
                ctx.fillStyle = current ? (s.active ? 'rgb(255, 215, 60)' : '#777') : '#1c1c1c';
                ctx.fillRect(X(bx), Y(y), u * 11, u * 8);
                this.text(ctx, st.label, X(bx + 5.5), Y(y + 4.2), u * 3.6, current ? '#000' : '#999', 'center');
            });
        });

        // Odczyty liczbowe: szczyt i RMS [dBFS]
        const fmt = (db) => (Number.isFinite(db) && db > this.DB_MIN ? `${db < 0 ? '−' : '+'}${Math.abs(db).toFixed(1)}` : '−∞');
        const c1 = lx + 8, c2 = lx + 32;
        this.text(ctx, 'szczyt', X(c1 + 18), Y(55), u * 3, '#999', 'right');
        this.text(ctx, 'RMS', X(c2 + 18), Y(55), u * 3, '#999', 'right');
        this.meters.forEach((m, ch) => {
            const y = 61.5 + ch * 7;
            this.text(ctx, ch ? 'P' : 'L', X(lx), Y(y), u * 4.6, '#ddd', 'left');
            this.text(ctx, fmt(m.db), X(c1 + 18), Y(y), u * 4.6, '#ddd', 'right');
            this.text(ctx, fmt(m.rmsDb), X(c2 + 18), Y(y), u * 4.6, '#ddd', 'right');
        });
        this.text(ctx, 'dBFS', X(c2 + 20), Y(65), u * 3, '#999', 'left');
        const corr = this.bothChannels ? `${this.correlation >= 0 ? '+' : '−'}${Math.abs(this.correlation).toFixed(2)}` : '—';
        this.text(ctx, `korelacja  ${corr}`, X(lx), Y(77), u * 4.6, '#ddd', 'left');

        // Korelacja
        this.drawCorrelation(ctx, X(26), Y(86), (PW - 52) * u, u * 5, u);

        if (!this.audio.isRunning()) {
            this.text(ctx, 'DŹWIĘK WSTRZYMANY – DOTKNIJ EKRANU', X(PW / 2), Y(55), u * 5, 'rgb(255, 80, 80)', 'center');
        }
    }

    drawMeter(ctx, x, y, w, h, meter, label, u, labelSide) {
        const toY = (db) => y + h * Math.min(1, Math.max(0, db / this.DB_MIN));
        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, w, h);

        // Słupek w trzech strefach: do -18 zielony, -18..-9 żółty, powyżej -9 czerwony
        const top = toY(meter.db);
        const zones = [[this.DB_MIN, this.REF, 'rgb(40, 200, 70)'], [this.REF, this.HIGH, 'rgb(240, 200, 0)'], [this.HIGH, 0, 'rgb(240, 40, 30)']];
        for (const [from, to, color] of zones) {
            const y0 = Math.max(top, toY(to)), y1 = toY(from);
            if (y1 > y0) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y0, w, y1 - y0);
            }
        }
        if (Number.isFinite(meter.peak) && meter.peak > this.DB_MIN) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x, Math.round(toY(meter.peak) - u * 0.4), w, u * 0.8);
        }

        // Podziałka
        const tx = labelSide === 'right' ? x + w + u * 1.5 : x - u * 1.5;
        for (const db of [0, -6, -9, -12, -18, -24, -30, -40, -50, -60]) {
            const ty = toY(db);
            const ref = db === this.REF;
            ctx.fillStyle = ref ? 'rgb(255, 215, 60)' : '#999';
            ctx.fillRect(labelSide === 'right' ? x + w : x - u * (ref ? 2.5 : 1), ty - u * 0.2, u * (ref ? 2.5 : 1), u * 0.4);
            this.text(ctx, String(db), tx + (labelSide === 'right' && ref ? u * 1.5 : labelSide === 'left' && ref ? -u * 1.5 : 0), ty, u * (ref ? 3.4 : 2.8), ref ? 'rgb(255, 215, 60)' : '#999', labelSide === 'right' ? 'left' : 'right');
        }
        this.text(ctx, label, x + w / 2, y - u * 4.5, u * 6, '#fff', 'center');
        this.text(ctx, 'dBFS', x + w / 2, y + h + u * 4, u * 2.8, '#999', 'center');
    }

    drawGoniometer(ctx, x, y, size, samples, u) {
        const g = this.gonio;
        const px = Math.max(16, Math.round(size));
        if (g.width !== px) {
            g.width = px;
            g.height = px;
        }
        const gctx = g.getContext('2d');
        // Poświata - poprzednie klatki gasną stopniowo
        gctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        gctx.fillRect(0, 0, px, px);

        const c = px / 2;
        // Skala: poziom odniesienia -18 dBFS na połowie promienia
        const scale = c * 0.5 / Math.pow(10, this.REF / 20);
        // Ciągła linia przez kolejne próbki (punkty tonu trafiałyby wciąż w te same miejsca)
        if (samples && this.audio.isRunning()) {
            const [L, R] = samples;
            const clamp = (v) => Math.max(-c, Math.min(c, v));
            gctx.strokeStyle = 'rgba(90, 255, 130, 0.9)';
            gctx.lineWidth = Math.max(1, px / 250);
            gctx.beginPath();
            for (let i = 0; i < L.length; i++) {
                const sx = clamp((R[i] - L[i]) * Math.SQRT1_2 * scale);
                const sy = clamp((L[i] + R[i]) * Math.SQRT1_2 * scale);
                if (i === 0) gctx.moveTo(c + sx, c - sy);
                else gctx.lineTo(c + sx, c - sy);
            }
            gctx.stroke();
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, size, size);
        ctx.drawImage(g, x, y, size, size);

        // Osie: M (pion), S (poziom), L i P (przekątne), okrąg poziomu odniesienia
        const cx = x + size / 2, cy = y + size / 2, r = size / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = Math.max(1, u * 0.25);
        ctx.beginPath();
        ctx.moveTo(cx, y); ctx.lineTo(cx, y + size);
        ctx.moveTo(x, cy); ctx.lineTo(x + size, cy);
        ctx.moveTo(x, y); ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y); ctx.lineTo(x, y + size);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#666';
        ctx.strokeRect(x, y, size, size);
        this.text(ctx, 'M', cx + u * 2.5, y + u * 3, u * 3.2, '#aaa', 'center');
        this.text(ctx, 'S', x + size - u * 2.5, cy - u * 2.5, u * 3.2, '#aaa', 'center');
        this.text(ctx, 'L', x + u * 3, y + u * 3, u * 3.6, 'rgb(255, 200, 0)', 'center');
        this.text(ctx, 'P', x + size - u * 3, y + u * 3, u * 3.6, 'rgb(0, 190, 255)', 'center');
    }

    drawCorrelation(ctx, x, y, w, h, u) {
        const mid = x + w / 2;
        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, w, h);
        if (this.bothChannels) {
            const v = this.correlation;
            ctx.fillStyle = v >= 0 ? 'rgb(40, 170, 60)' : 'rgb(230, 40, 30)';
            ctx.fillRect(Math.min(mid, mid + v * w / 2), y, Math.abs(v) * w / 2, h);
            ctx.fillStyle = '#fff';
            ctx.fillRect(mid + v * w / 2 - u * 0.5, y - u, u, h + 2 * u);
        }
        ctx.fillStyle = '#888';
        ctx.fillRect(mid - u * 0.2, y - u * 1.5, u * 0.4, h + 3 * u);
        this.text(ctx, '−1', x, y - u * 3, u * 4, '#ddd', 'left');
        this.text(ctx, '+1', x + w, y - u * 3, u * 4, '#ddd', 'right');
        this.text(ctx, '180°', x, y + h + u * 3.5, u * 3, '#999', 'left');
        this.text(ctx, '90°', mid, y + h + u * 3.5, u * 3, '#999', 'center');
        this.text(ctx, '0°', x + w, y + h + u * 3.5, u * 3, '#999', 'right');
        this.text(ctx, 'KORELACJA', mid, y - u * 3, u * 3, '#999', 'center');
    }

    text(ctx, str, x, y, size, color, align) {
        ctx.font = `bold ${Math.max(8, Math.round(size))}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(str, x, y);
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
}

window.StereoTestOverlay = StereoTestOverlay;
