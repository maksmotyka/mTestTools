// =============================================================================
// WSPÓLNE NARZĘDZIA DLA PLANSZ TESTOWYCH
// Przeglądarka rysuje w 8-bitowym RGB w pełnym zakresie (0-255). Poziomy z norm
// (w % sygnału, 0% = czerń, 100% = biel) przeliczane są na wartości 0-255.
// Program realizacyjny (OBS, vMix) zamienia to na YCbCr w zakresie studyjnym
// (16-235), więc 0% -> Y 16, a 100% -> Y 235. Poziomów spoza zakresu (np. -2%
// w PLUGE) nie da się przekazać przez przeglądarkę - są przycinane do czerni.
// =============================================================================

window.TestPatterns = window.TestPatterns || {};

const PatternUtils = {
    // Poziom w % -> wartość 0-255 (z przycięciem do zakresu)
    lvl(percent) {
        return Math.max(0, Math.min(255, Math.round(percent * 255 / 100)));
    },

    // Kolor z poziomów R, G, B w % -> 'rgb(...)'
    rgb(r, g, b) {
        return `rgb(${this.lvl(r)}, ${this.lvl(g)}, ${this.lvl(b)})`;
    },

    gray(percent) {
        return this.rgb(percent, percent, percent);
    },

    // Rysuje rząd pól o szerokościach podanych w jednostkach odniesienia
    // (np. pikselach wzorca 1920). Krawędzie zaokrąglane narastająco - bez szczelin.
    fillRow(ctx, x, y, width, height, cells) {
        const total = cells.reduce((sum, c) => sum + c.w, 0);
        let acc = 0;
        for (const cell of cells) {
            const x0 = x + Math.round(acc / total * width);
            acc += cell.w;
            const x1 = x + Math.round(acc / total * width);
            if (typeof cell.fill === 'function') {
                cell.fill(ctx, x0, y, x1 - x0, height);
            } else {
                ctx.fillStyle = cell.fill;
                ctx.fillRect(x0, y, x1 - x0, height);
            }
        }
    },

    // Rysuje rzędy o wysokościach w jednostkach odniesienia
    rowEdges(y, height, units) {
        const total = units.reduce((a, b) => a + b, 0);
        const edges = [y];
        let acc = 0;
        for (const u of units) {
            acc += u;
            edges.push(y + Math.round(acc / total * height));
        }
        return edges;
    },

    // Pozioma rampa luminancji 0% -> 100% (lub odwrotnie)
    rampFill(fromPercent, toPercent) {
        return (ctx, x, y, w, h) => {
            const grad = ctx.createLinearGradient(x, 0, x + w, 0);
            grad.addColorStop(0, PatternUtils.gray(fromPercent));
            grad.addColorStop(1, PatternUtils.gray(toPercent));
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, w, h);
        };
    },

    // Tekst z automatycznym dopasowaniem rozmiaru do szerokości
    fitText(ctx, text, cx, cy, maxWidth, size, color, weight = 'bold') {
        let fontSize = size;
        ctx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
        const measured = ctx.measureText(text).width;
        if (measured > maxWidth) {
            fontSize = Math.max(6, Math.floor(fontSize * maxWidth / measured));
            ctx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
        }
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);
    }
};

window.PatternUtils = PatternUtils;
