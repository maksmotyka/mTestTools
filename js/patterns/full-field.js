// =============================================================================
// PEŁNE POLE - jednolity kolor na całym ekranie
// Balans bieli kamery, równomierność podświetlenia, martwe piksele,
// ustawienie ekspozycji (szarość 18% w odbiciu ≈ 46% kodu sRGB).
// =============================================================================

(function () {
    const U = PatternUtils;

    const FIELDS = {
        white: ['Biel 100%', U.gray(100)],
        white75: ['Biel 75%', U.gray(75)],
        gray50: ['Szarość 50%', U.gray(50)],
        gray18: ['Szarość 18% (odbicie)', U.gray(46)],
        black: ['Czerń 0%', U.gray(0)],
        red: ['Czerwony 100%', U.rgb(100, 0, 0)],
        green: ['Zielony 100%', U.rgb(0, 100, 0)],
        blue: ['Niebieski 100%', U.rgb(0, 0, 100)],
        cyan: ['Cyjan 100%', U.rgb(0, 100, 100)],
        magenta: ['Magenta 100%', U.rgb(100, 0, 100)],
        yellow: ['Żółty 100%', U.rgb(100, 100, 0)]
    };

    window.TestPatterns['field'] = {
        name: 'Pełne pole',
        options: [
            {
                key: 'fieldColor',
                label: 'Kolor',
                values: Object.entries(FIELDS).map(([k, v]) => [k, v[0]]),
                default: 'white'
            }
        ],

        draw(ctx, w, h, opts) {
            const field = FIELDS[opts.fieldColor] || FIELDS.white;
            ctx.fillStyle = field[1];
            ctx.fillRect(0, 0, w, h);
            return {
                identBox: { cx: w / 2, cy: h * 0.4, h: h * 0.08 },
                clockBox: { cx: w / 2, cy: h * 0.6, h: h * 0.07 }
            };
        }
    };
})();
