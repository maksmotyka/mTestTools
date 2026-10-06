// =============================================================================
// PLANSZA KONTROLNA (w stylu Philips PM5544)
// Autorska interpretacja układu znanego z polskiej telewizji: szara siatka,
// duży okrąg i poziome pasy kontrolne w jego wnętrzu.
//
// Wnętrze okręgu (12 rzędów od góry):
//  0     - kastelacja (szybkie przejścia biel/czerń)
//  1     - pole identyfikacji (tekst ?ident=)
//  2-3   - pasy barwne 75%
//  4     - kraty rozdzielczości (okres 12, 8, 6, 4, 2 px fizycznego ekranu)
//  5-6   - krzyż centrujący
//  7     - skala szarości 0-100% (6 stopni)
//  8     - test odbić / smużenia (biała linia na czerni, czarna na bieli)
//  9     - widmo barw
//  10    - pole zegara
//  11    - kastelacja
// =============================================================================

(function () {
    const U = PatternUtils;

    function castellation(ctx, x0, x1, y, h, block) {
        let i = 0;
        for (let x = x0; x < x1; x += block, i++) {
            ctx.fillStyle = i % 2 ? U.gray(0) : U.gray(100);
            ctx.fillRect(Math.round(x), y, Math.round(x + block) - Math.round(x), h);
        }
    }

    function grating(ctx, x, y, w, h, period) {
        ctx.fillStyle = U.gray(0);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = U.gray(100);
        const half = period / 2;
        for (let px = x; px < x + w; px += period) {
            ctx.fillRect(px, y, Math.min(half, x + w - px), h);
        }
    }

    window.TestPatterns['card'] = {
        name: 'Plansza kontrolna',

        draw(ctx, w, h) {
            const c = h / 14;                       // bok kratki siatki
            const cx = Math.round(w / 2);
            const cy = Math.round(h / 2);
            const R = c * 6;
            const lineW = Math.max(1, Math.round(h / 270));

            // Tło i siatka
            ctx.fillStyle = U.gray(50);
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = U.gray(100);
            const kMax = Math.ceil(w / 2 / c);
            for (let k = -kMax; k <= kMax; k++) {
                const x = Math.round(cx + k * c - lineW / 2);
                ctx.fillRect(x, 0, lineW, h);
            }
            for (let k = 1; k < 14; k++) {
                const y = Math.round(k * c - lineW / 2);
                ctx.fillRect(0, y, w, lineW);
            }

            // Kastelacja na krawędziach obrazu (kontrola przesłon / overscanu)
            const edge = Math.round(c / 2);
            castellation(ctx, cx - kMax * c, w, 0, edge, c);
            castellation(ctx, cx - kMax * c, w, h - edge, edge, c);
            for (let k = 0; k < 14; k++) {
                ctx.fillStyle = k % 2 ? U.gray(100) : U.gray(0);
                const y0 = Math.round(k * c), y1 = Math.round((k + 1) * c);
                ctx.fillRect(0, y0, edge, y1 - y0);
                ctx.fillRect(w - edge, y0, edge, y1 - y0);
            }

            // Okręgi w narożnikach (geometria / ostrość na brzegach)
            ctx.strokeStyle = U.gray(100);
            ctx.lineWidth = lineW;
            const cornerK = Math.floor(w / 2 / c) - 2;
            if (cornerK > 6) {
                for (const sx of [-1, 1]) {
                    for (const yy of [2 * c, h - 2 * c]) {
                        ctx.beginPath();
                        ctx.arc(cx + sx * cornerK * c, yy, c * 1.4, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }

            // Wnętrze okręgu
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();

            const left = cx - R;
            const span = 2 * R;
            const rowY = (i) => Math.round(cy - R + i * c);
            const rowH = (i, n = 1) => rowY(i + n) - rowY(i);

            // 0 / 11 - kastelacja
            castellation(ctx, left, left + span, rowY(0), rowH(0), c / 2);
            castellation(ctx, left, left + span, rowY(11), rowH(11), c / 2);

            // 1 - pole identyfikacji
            ctx.fillStyle = U.gray(100);
            ctx.fillRect(left, rowY(1), span, rowH(1));
            const idW = c * 5.5, idH = c * 0.8;
            ctx.fillStyle = U.gray(0);
            ctx.fillRect(Math.round(cx - idW / 2), Math.round(rowY(1) + (c - idH) / 2), Math.round(idW), Math.round(idH));

            // 2-3 - pasy 75%
            const m = 75;
            U.fillRow(ctx, left, rowY(2), span, rowH(2, 2), [
                { w: 1, fill: U.rgb(m, m, 0) },
                { w: 1, fill: U.rgb(0, m, m) },
                { w: 1, fill: U.rgb(0, m, 0) },
                { w: 1, fill: U.rgb(m, 0, m) },
                { w: 1, fill: U.rgb(m, 0, 0) },
                { w: 1, fill: U.rgb(0, 0, m) }
            ]);

            // 4 - kraty rozdzielczości (wartości w pikselach ekranu)
            U.fillRow(ctx, left, rowY(4), span, rowH(4), [
                { w: 1, fill: U.gray(100) },
                ...[12, 8, 6, 4, 2].map(p => ({ w: 1, fill: (cx2, x, y, ww, hh) => grating(cx2, x, y, ww, hh, p) }))
            ]);

            // 5-6 - krzyż centrujący na czerni
            ctx.fillStyle = U.gray(0);
            ctx.fillRect(left, rowY(5), span, rowH(5, 2));
            ctx.fillStyle = U.gray(100);
            ctx.fillRect(left, Math.round(cy - lineW / 2), span, lineW);
            ctx.fillRect(Math.round(cx - lineW / 2), rowY(5), lineW, rowH(5, 2));
            ctx.strokeStyle = U.gray(100);
            ctx.lineWidth = lineW;
            ctx.strokeRect(Math.round(cx - c / 2), Math.round(cy - c / 2), Math.round(c), Math.round(c));

            // 7 - skala szarości
            U.fillRow(ctx, left, rowY(7), span, rowH(7),
                [0, 20, 40, 60, 80, 100].map(p => ({ w: 1, fill: U.gray(p) })));

            // 8 - test odbić i smużenia
            U.fillRow(ctx, left, rowY(8), span, rowH(8), [
                { w: 6, fill: U.gray(0) },
                { w: 0.5, fill: U.gray(100) },
                { w: 5.5, fill: U.gray(0) },
                { w: 6, fill: U.gray(100) },
                { w: 0.5, fill: U.gray(0) },
                { w: 5.5, fill: U.gray(100) }
            ]);

            // 9 - widmo barw (pełne nasycenie)
            const hue = ctx.createLinearGradient(left, 0, left + span, 0);
            ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']
                .forEach((col, i, arr) => hue.addColorStop(i / (arr.length - 1), col));
            ctx.fillStyle = hue;
            ctx.fillRect(left, rowY(9), span, rowH(9));

            // 10 - pole zegara
            ctx.fillStyle = U.gray(100);
            ctx.fillRect(left, rowY(10), span, rowH(10));
            const ckW = c * 4, ckH = c * 0.8;
            ctx.fillStyle = U.gray(0);
            ctx.fillRect(Math.round(cx - ckW / 2), Math.round(rowY(10) + (c - ckH) / 2), Math.round(ckW), Math.round(ckH));

            ctx.restore();

            // Obrys okręgu
            ctx.strokeStyle = U.gray(100);
            ctx.lineWidth = lineW * 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.stroke();

            return {
                identBox: { cx, cy: rowY(1) + c / 2, h: idH, maxW: idW * 0.92, boxed: false },
                clockBox: { cx, cy: rowY(10) + c / 2, h: ckH, maxW: ckW * 0.92, boxed: false }
            };
        }
    };
})();
