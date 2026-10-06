// =============================================================================
// PASY SMPTE RP 219 (ARIB STD-B28) - wieloformatowe pasy HD/SD
// Szerokości wg tabel C.1 / C.2 normy (wartości "ideal" dla 1920 px),
// wysokości rzędów: 7/12, 1/12, 1/12, 3/12 wysokości obrazu.
//
// Rząd 1: szarość 40% | pasy 75% | szarość 40%
// Rząd 2: 100% cyjan | *2 | biel 75% | 100% niebieski
// Rząd 3: 100% żółty | *3 | rampa Y 0-100% | 100% czerwony
// Rząd 4: szarość 15% | czerń | biel 100% | czerń | PLUGE -2/0/+2/0/+4 | czerń | szarość 15%
//
// Pole *2: biel 75% / biel 100% / +I / -I; pole *3: czerń / +Q (-I wymaga +Q).
// Poziom -2% leży poniżej czerni i w RGB przeglądarki jest przycinany do 0%.
// Przy ekranie węższym niż 16:9 rysowana jest wyłącznie część 4:3 (wg normy -
// obszar wspólny dla konwersji do SD 4:3).
// =============================================================================

(function () {
    const U = PatternUtils;

    // Składowe sygnałów I/Q wg RP 219 (w IRE ≈ % RGB)
    const SIGNAL_I_PLUS = U.rgb(41.2545, 16.6946, 0);
    const SIGNAL_I_MINUS = U.rgb(0, 24.5600, 41.2545);
    const SIGNAL_Q_PLUS = U.rgb(25.3605, 0, 47.0286);

    const SUB2 = {
        '75w': U.gray(75),
        '100w': U.gray(100),
        'i-plus': SIGNAL_I_PLUS,
        'i-minus': SIGNAL_I_MINUS
    };

    window.TestPatterns['rp219'] = {
        name: 'Pasy SMPTE RP 219 (HD)',
        options: [
            {
                key: 'rp219Sub',
                label: 'Pole *2 / *3',
                values: [
                    ['75w', 'Biel 75% / czerń'],
                    ['100w', 'Biel 100% / czerń'],
                    ['i-plus', '+I / czerń'],
                    ['i-minus', '−I / +Q']
                ],
                default: '75w'
            }
        ],

        draw(ctx, w, h, opts) {
            const sub = SUB2[opts.rp219Sub] ? opts.rp219Sub : '75w';
            const sub3 = sub === 'i-minus' ? SIGNAL_Q_PLUS : U.gray(0);
            const g75 = 75;

            // d - boczne pola (tylko 16:9); obszar 4:3 = 1440 jednostek
            const wide = w / h >= 1.55;
            const d = wide ? 240 : 0;
            const pillar = (fill) => ({ w: d, fill });
            const rows = U.rowEdges(0, h, [7, 1, 1, 3]);
            const rh = (i) => rows[i + 1] - rows[i];

            // Rząd 1 - pasy 75% w polu 4:3, szarość 40% po bokach
            U.fillRow(ctx, 0, rows[0], w, rh(0), [
                pillar(U.gray(40)),
                { w: 205, fill: U.gray(g75) },
                { w: 206, fill: U.rgb(g75, g75, 0) },
                { w: 206, fill: U.rgb(0, g75, g75) },
                { w: 206, fill: U.rgb(0, g75, 0) },
                { w: 206, fill: U.rgb(g75, 0, g75) },
                { w: 206, fill: U.rgb(g75, 0, 0) },
                { w: 205, fill: U.rgb(0, 0, g75) },
                pillar(U.gray(40))
            ]);

            // Rząd 2 - sygnał ustawienia chrominancji
            U.fillRow(ctx, 0, rows[1], w, rh(1), [
                pillar(U.rgb(0, 100, 100)),
                { w: 205, fill: SUB2[sub] },
                { w: 1235, fill: U.gray(g75) },
                pillar(U.rgb(0, 0, 100))
            ]);

            // Rząd 3 - rampa Y
            U.fillRow(ctx, 0, rows[2], w, rh(2), [
                pillar(U.rgb(100, 100, 0)),
                { w: 205, fill: sub3 },
                { w: 1235, fill: U.rampFill(0, 100) },
                pillar(U.rgb(100, 0, 0))
            ]);

            // Rząd 4 - biel 100% i PLUGE
            U.fillRow(ctx, 0, rows[3], w, rh(3), [
                pillar(U.gray(15)),
                { w: 309, fill: U.gray(0) },
                { w: 411, fill: U.gray(100) },
                { w: 171, fill: U.gray(0) },
                { w: 69, fill: U.gray(-2) },
                { w: 68, fill: U.gray(0) },
                { w: 69, fill: U.gray(2) },
                { w: 68, fill: U.gray(0) },
                { w: 69, fill: U.gray(4) },
                { w: 206, fill: U.gray(0) },
                pillar(U.gray(15))
            ]);

            // Ident i zegar na czarnym polu po lewej stronie rzędu 4
            const unit = w / (1440 + 2 * d);
            const blackCx = (d + 309 / 2) * unit;
            return {
                identBox: { cx: w / 2, cy: rows[1] * 0.5, h: h * 0.08 },
                clockBox: { cx: blackCx, cy: (rows[3] + h) / 2, h: rh(3) * 0.3, maxW: 300 * unit }
            };
        }
    };
})();
