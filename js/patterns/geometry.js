// =============================================================================
// GEOMETRIA I STREFY BEZPIECZNE
// - siatka kwadratów i okręgi - liniowość geometrii, proporcje obrazu
// - strefy wg EBU R 95: action safe (3,5% od każdej krawędzi) i graphics safe (5%)
// - obszar 4:3 wycięty ze środka obrazu 16:9 (center cut)
// - pola 1:1 w narożnikach: linie o szerokości 1 piksela fizycznego ekranu -
//   jeśli obraz jest skalowany (np. źródło w OBS o złej rozdzielczości),
//   zamiast ostrych linii widać szare pole lub mory
// =============================================================================

(function () {
    const U = PatternUtils;

    function pixelPatch(ctx, x, y, size) {
        const half = Math.floor(size / 2);
        // Lewa połowa: linie pionowe 1 px, prawa: linie poziome 1 px
        for (let i = 0; i < half; i++) {
            ctx.fillStyle = i % 2 ? U.gray(0) : U.gray(100);
            ctx.fillRect(x + i, y, 1, size);
        }
        for (let j = 0; j < size; j++) {
            ctx.fillStyle = j % 2 ? U.gray(0) : U.gray(100);
            ctx.fillRect(x + half, y + j, size - half, 1);
        }
    }

    // Prostokąt z etykietą wewnątrz górnej krawędzi lub pod dolną krawędzią (labelAtBottom)
    function labelledRect(ctx, x, y, w, h, color, label, fontSize, labelAtBottom) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.round(fontSize / 8));
        ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
        ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + fontSize * 0.4, labelAtBottom ? y + h + fontSize * 0.2 : y + fontSize * 0.3);
    }

    window.TestPatterns['geometry'] = {
        name: 'Geometria i strefy bezpieczne',

        draw(ctx, w, h, opts) {
            const cx = w / 2, cy = h / 2;
            const lineW = Math.max(1, Math.round(h / 540));
            const fontSize = Math.max(10, Math.round(h / 48));

            ctx.fillStyle = U.gray(0);
            ctx.fillRect(0, 0, w, h);

            // Siatka - 16 kratek w pionie, wyśrodkowana
            const c = h / 16;
            ctx.fillStyle = U.gray(60);
            for (let k = -Math.ceil(cx / c); k <= Math.ceil(cx / c); k++) {
                ctx.fillRect(Math.round(cx + k * c - lineW / 2), 0, lineW, h);
            }
            for (let k = -8; k <= 8; k++) {
                ctx.fillRect(0, Math.round(cy + k * c - lineW / 2), w, lineW);
            }

            // Duży okrąg i okręgi w narożnikach
            ctx.strokeStyle = U.gray(100);
            ctx.lineWidth = lineW * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, h * 0.45, 0, Math.PI * 2);
            ctx.stroke();
            const r = h * 0.12;
            for (const [x, y] of [[r * 1.25, r * 1.25], [w - r * 1.25, r * 1.25], [r * 1.25, h - r * 1.25], [w - r * 1.25, h - r * 1.25]]) {
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Krzyż centrujący i przekątne
            ctx.fillStyle = U.gray(100);
            ctx.fillRect(Math.round(cx - lineW), 0, lineW * 2, h);
            ctx.fillRect(0, Math.round(cy - lineW), w, lineW * 2);
            ctx.strokeStyle = U.gray(35);
            ctx.lineWidth = lineW;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(w, h);
            ctx.moveTo(w, 0); ctx.lineTo(0, h);
            ctx.stroke();

            // Podziałka na krawędziach co 1% (dłuższa kreska co 5%)
            ctx.fillStyle = U.gray(100);
            for (let p = 0; p <= 100; p++) {
                const len = (p % 5 === 0 ? 2 : 1) * fontSize * 0.5;
                const x = Math.round(p / 100 * (w - lineW));
                const y = Math.round(p / 100 * (h - lineW));
                ctx.fillRect(x, 0, lineW, len);
                ctx.fillRect(x, h - len, lineW, len);
                ctx.fillRect(0, y, len, lineW);
                ctx.fillRect(w - len, y, len, lineW);
            }

            // Obszar 4:3 (center cut) - tylko gdy obraz jest szerszy niż 4:3
            if (w / h > 4 / 3 + 0.01) {
                const w43 = h * 4 / 3;
                ctx.save();
                ctx.strokeStyle = U.rgb(0, 100, 100);
                ctx.lineWidth = Math.max(1, Math.round(fontSize / 8));
                ctx.setLineDash([fontSize, fontSize / 2]);
                ctx.beginPath();
                for (const x of [Math.round(cx - w43 / 2) + 0.5, Math.round(cx + w43 / 2) - 0.5]) {
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, h);
                }
                ctx.stroke();
                ctx.restore();
                ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
                ctx.fillStyle = U.rgb(0, 100, 100);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText('4:3', cx - w43 / 2 + fontSize * 0.4, cy - c * 1.5);
            }

            // Strefy bezpieczne EBU R 95
            labelledRect(ctx, w * 0.035, h * 0.035, w * 0.93, h * 0.93, U.rgb(0, 100, 0), 'ACTION SAFE 93% (EBU R 95)', fontSize, true);
            labelledRect(ctx, w * 0.05, h * 0.05, w * 0.90, h * 0.90, U.rgb(100, 100, 0), 'GRAPHICS SAFE 90%', fontSize, false);

            // Pola 1:1 w narożnikach strefy graphics safe
            const patch = Math.max(16, Math.round(h / 18));
            const px = Math.round(w * 0.05 + fontSize);
            const py = Math.round(h * 0.05 + fontSize * 2);
            pixelPatch(ctx, px, py, patch);
            pixelPatch(ctx, Math.round(w * 0.95 - fontSize - patch), py, patch);
            pixelPatch(ctx, px, Math.round(h * 0.95 - fontSize - patch), patch);
            pixelPatch(ctx, Math.round(w * 0.95 - fontSize - patch), Math.round(h * 0.95 - fontSize - patch), patch);

            // Informacja o rozdzielczości obrazu
            const info = `${w} × ${h} px  ·  ${(w / h).toFixed(3)}:1  ·  DPR ${opts.dpr}`;
            ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
            const tw = ctx.measureText(info).width + fontSize;
            ctx.fillStyle = U.gray(0);
            ctx.fillRect(Math.round(cx - tw / 2), Math.round(cy + c * 0.5), Math.round(tw), Math.round(fontSize * 1.8));
            U.fitText(ctx, info, cx, cy + c * 0.5 + fontSize * 0.9, w * 0.8, fontSize, U.gray(100));

            return {
                identBox: { cx, cy: cy - c * 2.5, h: c * 0.9 },
                clockBox: { cx, cy: cy + c * 2.5, h: c * 0.8 }
            };
        }
    };
})();
