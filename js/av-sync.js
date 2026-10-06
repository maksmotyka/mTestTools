// =============================================================================
// SYNCHRONIZACJA OBRAZU I DŹWIĘKU (lip-sync) - część wizyjna
//
// Ton testowy (audio-engine.js, tryb 'sync') startuje w każdej wielokrotności
// okresu zegara AudioContext. Ta warstwa odczytuje ten sam zegar i pokazuje:
//  - BŁYSK      - pole (lub cały ekran) białe dokładnie wtedy, gdy brzmi ton,
//  - TARCZĘ     - wskazówka obiega tarczę raz na okres; czerwony łuk to czas
//                 trwania tonu (od START na godz. 12 do STOP),
//  - ZNACZNIKI  - dwa trójkąty zbiegają się w środku w chwili startu tonu,
//  - LICZNIK    - czas [ms] względem startu tonu, czytelny na każdej klatce nagrania,
//  - LINIJKĘ    - kursor ±200 ms na tle tolerancji EBU R 37, ITU-R BT.1359, ATSC IS-191,
//  - TAŚMĘ KLATEK - pole przesuwane o 1 przy każdej klatce ekranu (gubienie klatek).
//
// Odczyt z nagrania: znajdź klatkę, w której zaczyna się ton (np. na przebiegu
// w montażówce) i odczytaj licznik. Wartość dodatnia = dźwięk spóźniony
// względem obrazu, ujemna = dźwięk wyprzedza obraz.
// =============================================================================

class AVSyncOverlay {
    constructor(audio) {
        this.audio = audio;
        this.frameCount = 0;

        // Tolerancje w osi "czas obrazu względem startu dźwięku" [ms]:
        // dźwięk wyprzedzający o X ms -> -X, dźwięk spóźniony o Y ms -> +Y
        this.tolerances = [
            { name: 'ATSC IS-191', from: -15, to: 45, color: 'rgb(0, 200, 90)' },
            { name: 'EBU R 37', from: -40, to: 60, color: 'rgb(0, 160, 75)' },
            { name: 'BT.1359 wykrywalne', from: -45, to: 125, color: 'rgb(220, 180, 0)' },
            { name: 'BT.1359 akceptowalne', from: -90, to: 185, color: 'rgb(230, 110, 0)' }
        ];
    }

    // Wysokość panelu - także dla rozmieszczenia napisów (overlay.js)
    static panelHeight(w, h) {
        return Math.min(w * 0.86, h * 1.3) * 0.5;
    }

    static mod(a, n) {
        return ((a % n) + n) % n;
    }

    // Stan synchronizacji dla klatki prezentowanej w chwili displayPerfMs
    state(displayPerfMs, frameMs, cfg) {
        const P = cfg.syncPeriod;
        const D = cfg.syncDuration / 1000;
        const t = this.audio.getAudioTime(displayPerfMs) - cfg.syncOffset / 1000;
        // Przesunięcie o pół klatki - błysk na klatce najbliższej startowi tonu
        const phaseCentered = AVSyncOverlay.mod(t + frameMs / 2000, P);
        return {
            P, D,
            phase: AVSyncOverlay.mod(t, P),
            toneOn: phaseCentered < D,
            rel: (AVSyncOverlay.mod(t + P / 2, P) - P / 2) * 1000   // ms względem startu tonu
        };
    }

    draw(ctx, w, h, rafTs, frameMs, cfg) {
        this.frameCount++;
        const s = this.state(rafTs + frameMs, frameMs, cfg);

        if (cfg.syncFlash === 'screen' && s.toneOn) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
        }

        // Panel
        const pw = Math.min(w * 0.86, h * 1.3);
        const ph = AVSyncOverlay.panelHeight(w, h);
        const px = (w - pw) / 2;
        const py = (h - ph) / 2;
        const u = ph / 100;                         // jednostka rysunku
        ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
        this.roundRect(ctx, px, py, pw, ph, u * 3);
        ctx.fill();

        // --- Tarcza z błyskiem ---
        const dcx = px + u * 40, dcy = py + u * 46, dr = u * 34;
        this.drawDial(ctx, dcx, dcy, dr, u, s);

        // --- Prawa część ---
        const rx = px + u * 86;
        const rw = px + pw - u * 6 - rx;
        this.drawMarkers(ctx, rx, py + u * 14, rw, u, s);
        this.drawCounter(ctx, rx, py + u * 30, rw, u, s);
        this.drawRuler(ctx, rx, py + u * 56, rw, u, s);
        this.drawFrameStrip(ctx, px + u * 6, py + ph - u * 9, pw - u * 12, u * 4.5);

        // Ostrzeżenie o wstrzymanym dźwięku
        if (!this.audio.isRunning() && cfg.audio === 'sync') {
            this.text(ctx, 'DŹWIĘK WSTRZYMANY – DOTKNIJ EKRANU', dcx, py + u * 89, u * 4, 'rgb(255, 80, 80)', 'center');
        }
        return s;
    }

    drawDial(ctx, cx, cy, r, u, s) {
        const startA = -Math.PI / 2;
        const toneA = startA + s.D / s.P * Math.PI * 2;

        // Błysk
        const box = r * 1.05;
        ctx.fillStyle = s.toneOn ? '#fff' : '#222';
        ctx.fillRect(Math.round(cx - box / 2), Math.round(cy - box / 2), Math.round(box), Math.round(box));
        if (!s.toneOn) {
            this.text(ctx, 'BŁYSK', cx, cy, u * 5, '#555', 'center');
        }

        // Pierścień i łuk tonu
        ctx.lineWidth = u * 4;
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = s.toneOn ? 'rgb(255, 40, 40)' : 'rgb(150, 20, 20)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, startA, Math.max(toneA, startA + 0.02));
        ctx.stroke();

        // Podziałka - 20 kresek na okres
        ctx.lineWidth = Math.max(1, u * 0.5);
        ctx.strokeStyle = '#999';
        for (let i = 0; i < 20; i++) {
            const a = startA + i / 20 * Math.PI * 2;
            const r1 = r + u * 2.5, r2 = r + (i % 5 === 0 ? u * 5.5 : u * 4);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
            ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
            ctx.stroke();
        }
        this.text(ctx, 'START', cx, cy - r - u * 8.5, u * 3.6, '#fff', 'center');
        const stopX = cx + Math.cos(toneA) * (r + u * 9);
        const stopY = cy + Math.sin(toneA) * (r + u * 9);
        if (s.D / s.P > 0.06) {
            this.text(ctx, 'STOP', stopX, stopY, u * 3.6, 'rgb(255, 90, 90)', 'center');
        }

        // Wskazówka
        const a = startA + s.phase / s.P * Math.PI * 2;
        ctx.strokeStyle = s.toneOn ? 'rgb(255, 40, 40)' : '#fff';
        ctx.lineWidth = u * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
        ctx.lineTo(cx + Math.cos(a) * (r + u * 3), cy + Math.sin(a) * (r + u * 3));
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    // Trójkąty zbiegające się do środka w chwili startu tonu (rozbieg max. 1 s)
    drawMarkers(ctx, x, y, w, u, s) {
        const lead = Math.min(1, s.P - s.D - 0.1);
        const mid = x + w / 2;
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y - u * 0.4, w, u * 0.8);
        ctx.fillStyle = s.toneOn ? '#fff' : '#666';
        ctx.fillRect(mid - u * 0.6, y - u * 6, u * 1.2, u * 12);

        let progress = null;
        const relS = s.rel / 1000;
        if (relS >= -lead && relS < 0) progress = 1 + relS / lead;
        if (s.toneOn || (relS >= 0 && relS < s.D)) progress = 1;
        if (progress === null) return;

        const half = w / 2 - u * 2;
        const color = progress >= 1 ? 'rgb(255, 40, 40)' : '#fff';
        this.triangle(ctx, x + u * 2 + half * progress, y, u * 4, 1, color);
        this.triangle(ctx, x + w - u * 2 - half * progress, y, u * 4, -1, color);
    }

    drawCounter(ctx, x, y, w, u, s) {
        const ms = Math.round(s.rel);
        const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
        const value = `${sign}${String(Math.abs(ms)).padStart(4, '0')} ms`;
        ctx.font = `bold ${Math.round(u * 13)}px "Courier New", Courier, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = s.toneOn ? 'rgb(255, 60, 60)' : '#fff';
        ctx.fillText(value, x + w / 2, y + u * 6, w);
        this.text(ctx, 'czas obrazu względem startu tonu', x + w / 2, y + u * 16, u * 3.2, '#999', 'center');
    }

    drawRuler(ctx, x, y, w, u, s) {
        const range = 200;
        const toX = (ms) => x + (ms + range) / (2 * range) * w;
        const rowH = u * 2.6;

        // Pasy tolerancji (od najszerszej)
        [...this.tolerances].reverse().forEach((tol, i) => {
            const ry = y + i * (rowH + u * 0.6);
            ctx.fillStyle = tol.color;
            const x0 = toX(Math.max(-range, tol.from)), x1 = toX(Math.min(range, tol.to));
            ctx.fillRect(x0, ry, x1 - x0, rowH);
            this.text(ctx, tol.name, x0 + u, ry + rowH / 2, u * 2.1, '#000', 'left');
        });
        const bottom = y + 4 * (rowH + u * 0.6);

        // Podziałka co 20 ms
        ctx.fillStyle = '#bbb';
        for (let ms = -range; ms <= range; ms += 20) {
            const tall = ms % 100 === 0;
            ctx.fillRect(Math.round(toX(ms)), bottom, Math.max(1, u * 0.3), tall ? u * 3 : u * 1.6);
            if (tall) {
                this.text(ctx, `${ms > 0 ? '+' : ''}${ms}`, toX(ms), bottom + u * 5.5, u * 2.8, '#bbb', 'center');
            }
        }
        this.text(ctx, '◄ dźwięk wyprzedza', x, bottom + u * 10, u * 2.8, '#888', 'left');
        this.text(ctx, 'dźwięk spóźniony ►', x + w, bottom + u * 10, u * 2.8, '#888', 'right');

        // Kursor
        if (Math.abs(s.rel) <= range) {
            const cxp = toX(s.rel);
            ctx.fillStyle = Math.abs(s.rel) < 10 ? 'rgb(255, 40, 40)' : '#fff';
            ctx.fillRect(Math.round(cxp - u * 0.6), y - u * 2, u * 1.2, bottom - y + u * 4);
        }
    }

    drawFrameStrip(ctx, x, y, w, h) {
        const n = 30;
        const cell = w / n;
        const lit = this.frameCount % n;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = i === lit ? '#fff' : (i % 2 ? '#1a1a1a' : '#262626');
            ctx.fillRect(Math.round(x + i * cell), y, Math.round(x + (i + 1) * cell) - Math.round(x + i * cell), h);
        }
    }

    triangle(ctx, x, y, size, dir, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dir * size * 1.4, y - size);
        ctx.lineTo(x - dir * size * 1.4, y + size);
        ctx.closePath();
        ctx.fill();
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

window.AVSyncOverlay = AVSyncOverlay;
