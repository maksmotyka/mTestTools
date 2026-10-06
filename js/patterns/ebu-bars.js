// =============================================================================
// PASY BARWNE EBU (ITU-R BT.471)
// Oznaczenie a/b/c/d: biel / czerń / maks. kolorów / min. kolorów (w % bieli).
// - 100/0/75/0  - "pasy 75%", klasyczny sygnał kontrolny w Europie
// - 100/0/100/0 - pasy pełnej amplitudy
// Kolejność: biel, żółty, cyjan, zielony, magenta, czerwony, niebieski, czerń.
// =============================================================================

function createEbuBars(colourMax) {
    const U = PatternUtils;
    return {
        draw(ctx, w, h) {
            const m = colourMax;
            U.fillRow(ctx, 0, 0, w, h, [
                { w: 1, fill: U.gray(100) },
                { w: 1, fill: U.rgb(m, m, 0) },
                { w: 1, fill: U.rgb(0, m, m) },
                { w: 1, fill: U.rgb(0, m, 0) },
                { w: 1, fill: U.rgb(m, 0, m) },
                { w: 1, fill: U.rgb(m, 0, 0) },
                { w: 1, fill: U.rgb(0, 0, m) },
                { w: 1, fill: U.gray(0) }
            ]);
            // Ident i zegar w dolnej części obrazu (na czarno-białej granicy pasów)
            return {
                identBox: { cx: w / 2, cy: h * 0.72, h: h * 0.09 },
                clockBox: { cx: w / 2, cy: h * 0.84, h: h * 0.07 }
            };
        }
    };
}

window.TestPatterns['ebu75'] = {
    name: 'Pasy EBU 100/0/75/0',
    ...createEbuBars(75)
};

window.TestPatterns['ebu100'] = {
    name: 'Pasy EBU 100/0/100/0',
    ...createEbuBars(100)
};
