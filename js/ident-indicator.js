// =============================================================================
// WSKAŹNIK IDENTYFIKACJI KANAŁÓW (EBU / GLITS)
// Okrąg obraca się raz na cykl sekwencji (EBU 3 s, GLITS 4 s). Bloczki na okręgu
// to przerwy w tonie - ich długość kątowa odpowiada czasowi przerwy (250 ms).
// Stała linia na godz. 12 to "teraz": gdy bloczek wjeżdża na linię, w danym
// kanale zaczyna się przerwa, gdy z niej zjeżdża - ton wraca.
// Lampki L / P w środku świecą, gdy w kanale brzmi ton.
// Czas pochodzi z tego samego zegara audio co dźwięk (AudioEngine.getAudioTime).
// =============================================================================

class IdentIndicator {
    constructor(audio) {
        this.audio = audio;
        this.colors = ['rgb(255, 200, 0)', 'rgb(0, 190, 255)'];   // L, P
        this.names = ['L', 'P'];
    }

    // Średnica wskaźnika na środku ekranu (null w rogu) - dla rozmieszczenia napisów
    static centerSize(h, position) {
        return position === 'center' ? h * 0.36 : null;
    }

    static mod(a, n) {
        return ((a % n) + n) % n;
    }

    state(displayPerfMs, frameMs, cfg, ident) {
        const t = this.audio.getAudioTime(displayPerfMs) - cfg.syncOffset / 1000;
        const phase = IdentIndicator.mod(t, ident.cycle);
        // Przesunięcie o pół klatki - zmiana stanu na klatce najbliższej zdarzeniu
        const centered = IdentIndicator.mod(t + frameMs / 2000, ident.cycle);
        const gapActive = ident.gaps.map(g => centered >= g.start && centered < g.start + g.dur);
        const channelOn = [0, 1].map(ch => !ident.gaps.some((g, i) => g.ch === ch && gapActive[i]));
        return { phase, gapActive, channelOn };
    }

    draw(ctx, w, h, rafTs, frameMs, cfg) {
        const ident = AudioEngine.IDENTS[cfg.audio];
        if (!ident) return;
        const s = this.state(rafTs + frameMs, frameMs, cfg, ident);

        // Położenie: prawy dolny róg strefy graphics safe lub środek ekranu
        const size = IdentIndicator.centerSize(h, cfg.identIndicator) || h * 0.24;
        const cx = cfg.identIndicator === 'center' ? w / 2 : w * 0.95 - size / 2;
        const cy = cfg.identIndicator === 'center' ? h / 2 : h * 0.95 - size / 2;
        const u = size / 100;
        const r = u * 34;
        const lineA = -Math.PI / 2;
        const k = Math.PI * 2 / ident.cycle;

        // Tło
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy, u * 50, 0, Math.PI * 2);
        ctx.fill();

        // Tor okręgu z podziałką obracającą się razem z bloczkami (co 250 ms)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = u * 9;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        const ticks = Math.round(ident.cycle * 4);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = Math.max(1, u * 0.8);
        for (let i = 0; i < ticks; i++) {
            const a = lineA + (s.phase - i * 0.25) * k;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * (r - u * 4.5), cy + Math.sin(a) * (r - u * 4.5));
            ctx.lineTo(cx + Math.cos(a) * (r + u * 4.5), cy + Math.sin(a) * (r + u * 4.5));
            ctx.stroke();
        }

        // Bloczki przerw - nadjeżdżają zgodnie z ruchem wskazówek zegara,
        // krawędź natarcia dociera do linii w chwili początku przerwy
        ident.gaps.forEach((g, i) => {
            const a0 = lineA - (g.start + g.dur - s.phase) * k;
            const a1 = lineA - (g.start - s.phase) * k;
            ctx.strokeStyle = this.colors[g.ch];
            ctx.lineWidth = u * 13;
            ctx.beginPath();
            ctx.arc(cx, cy, r, a0, a1);
            ctx.stroke();
            const am = (a0 + a1) / 2;
            this.text(ctx, this.names[g.ch], cx + Math.cos(am) * r, cy + Math.sin(am) * r, u * 8, '#000');
        });

        // Linia "teraz" - czerwona, gdy trwa przerwa
        const anyGap = s.gapActive.some(Boolean);
        ctx.strokeStyle = anyGap ? 'rgb(255, 40, 40)' : '#fff';
        ctx.lineWidth = u * 2.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r + u * 10);
        ctx.lineTo(cx, cy - r - u * 11);
        ctx.stroke();

        // Lampki kanałów
        [0, 1].forEach(ch => {
            const lx = cx + (ch ? 1 : -1) * u * 10;
            ctx.fillStyle = s.channelOn[ch] ? this.colors[ch] : '#222';
            ctx.beginPath();
            ctx.arc(lx, cy - u * 2, u * 8, 0, Math.PI * 2);
            ctx.fill();
            this.text(ctx, this.names[ch], lx, cy - u * 2, u * 8, s.channelOn[ch] ? '#000' : '#555');
        });
        this.text(ctx, ident.name, cx, cy + u * 14, u * 7, '#ccc');
    }

    text(ctx, str, x, y, size, color) {
        ctx.font = `bold ${Math.max(8, Math.round(size))}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(str, x, y);
    }
}

window.IdentIndicator = IdentIndicator;
