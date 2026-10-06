// =============================================================================
// SKALA SZAROŚCI I PLUGE
// - 11 stopni 0-100% co 10% (liniowość przetwarzania, gamma)
// - rampa 0-100% (pasmowanie / banding po kompresji)
// - pola przy czerni 1-6% (ustawienie jasności monitora, "zgniatanie" czerni
//   przez kamerę lub enkoder) - w roli PLUGE: przy prawidłowo ustawionym
//   monitorze pole +2% powinno być ledwie widoczne na tle czerni
// - pola przy bieli 94-99% (przepalenia - ustawienie przysłony / zebry w kamerze)
// =============================================================================

(function () {
    const U = PatternUtils;

    function labelledSteps(ctx, x, y, w, h, bg, levels, labelColor, fontSize) {
        ctx.fillStyle = U.gray(bg);
        ctx.fillRect(x, y, w, h);
        const n = levels.length;
        const slot = w / n;
        const pw = slot * 0.6;
        levels.forEach((p, i) => {
            const px = x + slot * i + (slot - pw) / 2;
            ctx.fillStyle = U.gray(p);
            ctx.fillRect(Math.round(px), Math.round(y + h * 0.12), Math.round(pw), Math.round(h * 0.62));
            U.fitText(ctx, `${p}%`, px + pw / 2, y + h * 0.87, slot, fontSize, labelColor, 'normal');
        });
    }

    window.TestPatterns['gray'] = {
        name: 'Skala szarości i PLUGE',

        draw(ctx, w, h) {
            const rows = U.rowEdges(0, h, [35, 15, 25, 25]);
            const fontSize = Math.max(10, Math.round(h / 45));

            // Schodki 0-100%
            const steps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            U.fillRow(ctx, 0, rows[0], w, rows[1] - rows[0], steps.map(p => ({ w: 1, fill: U.gray(p) })));
            steps.forEach((p, i) => {
                const x = (i + 0.5) * w / steps.length;
                U.fitText(ctx, `${p}`, x, rows[1] - fontSize, w / steps.length, fontSize, p >= 50 ? U.gray(0) : U.gray(100), 'normal');
            });

            // Rampa
            U.rampFill(0, 100)(ctx, 0, rows[1], w, rows[2] - rows[1]);

            // Przy czerni (PLUGE) i przy bieli
            labelledSteps(ctx, 0, rows[2], w, rows[3] - rows[2], 0, [1, 2, 3, 4, 5, 6], U.gray(50), fontSize);
            labelledSteps(ctx, 0, rows[3], w, h - rows[3], 100, [94, 95, 96, 97, 98, 99], U.gray(50), fontSize);

            return {
                identBox: { cx: w / 2, cy: rows[0] + (rows[1] - rows[0]) * 0.4, h: h * 0.07 },
                clockBox: { cx: w / 2, cy: rows[0] + (rows[1] - rows[0]) * 0.65, h: h * 0.055 }
            };
        }
    };
})();
