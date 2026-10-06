// =============================================================================
// NAKŁADKI NA PLANSZĘ - identyfikator źródła (tekst i/lub logo), zegar, opis sygnału
// Pozycje identyfikatora i zegara podpowiada plansza (identBox / clockBox).
// Zegar jest elementem ruchomym - pozwala też odróżnić żywe źródło od zamrożonej klatki.
// =============================================================================

class Overlay {
    drawLabel(ctx, text, box, fontScale = 0.62) {
        if (!text || !box) return;
        const size = Math.round(box.h * fontScale);
        ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
        const maxW = box.maxW || ctx.canvas.width * 0.8;
        if (box.boxed !== false) {
            const tw = Math.min(maxW, ctx.measureText(text).width) + box.h * 0.8;
            ctx.fillStyle = '#000';
            ctx.fillRect(Math.round(box.cx - tw / 2), Math.round(box.cy - box.h / 2), Math.round(tw), Math.round(box.h));
        }
        PatternUtils.fitText(ctx, text, box.cx, box.cy + size * 0.04, maxW, size, '#fff');
    }

    // Identyfikator: sam tekst, samo logo lub logo z tekstem (cfg.identMode).
    // Logo z przezroczystością dostaje czarne tło, logo nieprzezroczyste rysowane jest bez tła.
    drawIdent(ctx, cfg, box, logo) {
        if (!box) return;
        const mode = logo ? cfg.identMode : 'text';
        if (mode === 'text' || (mode === 'both' && !cfg.ident)) {
            if (mode === 'text') this.drawLabel(ctx, cfg.ident, box);
            else this.drawLogo(ctx, box, logo);
            return;
        }
        if (mode === 'logo') {
            this.drawLogo(ctx, box, logo);
            return;
        }

        // Logo i tekst w jednym wierszu, na wspólnym czarnym tle
        const img = logo.img;
        const maxW = box.maxW || ctx.canvas.width * 0.8;
        const lh = box.h * 0.8;
        const lw = Math.min(lh * img.naturalWidth / img.naturalHeight, maxW * 0.5);
        const lhFit = lw * img.naturalHeight / img.naturalWidth;
        const gap = box.h * 0.3;
        let size = Math.round(box.h * 0.62);
        ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
        const tw = Math.min(ctx.measureText(cfg.ident).width, maxW - lw - gap);
        const total = lw + gap + tw;
        const x0 = box.cx - total / 2;
        if (box.boxed !== false) {
            ctx.fillStyle = '#000';
            ctx.fillRect(Math.round(x0 - box.h * 0.4), Math.round(box.cy - box.h / 2), Math.round(total + box.h * 0.8), Math.round(box.h));
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x0, box.cy - lhFit / 2, lw, lhFit);
        PatternUtils.fitText(ctx, cfg.ident, x0 + lw + gap + tw / 2, box.cy + size * 0.04, tw, size, '#fff');
    }

    drawLogo(ctx, box, logo) {
        const img = logo.img;
        const maxW = box.maxW || ctx.canvas.width * 0.6;
        // W stałym polu planszy (plansza kontrolna) logo mieści się w polu, w innych może być większe
        let lh = box.boxed === false ? box.h * 0.9 : box.h * 1.5;
        let lw = lh * img.naturalWidth / img.naturalHeight;
        if (lw > maxW) {
            lh *= maxW / lw;
            lw = maxW;
        }
        if (logo.hasAlpha && box.boxed !== false) {
            const pad = lh * 0.12;
            ctx.fillStyle = '#000';
            ctx.fillRect(Math.round(box.cx - lw / 2 - pad), Math.round(box.cy - lh / 2 - pad), Math.round(lw + 2 * pad), Math.round(lh + 2 * pad));
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, box.cx - lw / 2, box.cy - lh / 2, lw, lh);
    }

    clockText() {
        const d = new Date();
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    }

    // centerH - wysokość elementu zajmującego środek ekranu (panel synchronizacji A/V,
    // wskaźnik identyfikacji na środku) lub null, gdy środek planszy jest wolny
    draw(ctx, w, h, hints, cfg, audioDescription, centerH, logo) {
        let identBox = hints.identBox;
        let clockBox = hints.clockBox;
        const info = cfg.audioInfo ? audioDescription : '';
        const infoH = Math.round(h * 0.045);
        const infoBox = { cx: w / 2, cy: h - infoH * 1.6, h: infoH };

        // Środek ekranu zajęty - identyfikator nad elementem; zegar zostaje na swoim
        // miejscu, chyba że nachodzi na element - wtedy między elementem a opisem sygnału
        if (centerH) {
            const free = (h - centerH) / 2;
            identBox = { cx: w / 2, cy: free / 2, h: Math.min(free * 0.6, h * 0.08) };
            if (clockBox && clockBox.cy - clockBox.h / 2 < h - free) {
                const bottom = info ? infoBox.cy - infoH / 2 : h;
                const gap = bottom - (h - free);
                clockBox = { cx: w / 2, cy: h - free + gap / 2, h: Math.min(gap * 0.75, h * 0.07) };
            }
        }

        this.drawIdent(ctx, cfg, identBox, logo);
        if (cfg.clock) this.drawLabel(ctx, this.clockText(), clockBox, 0.72);
        if (info) this.drawLabel(ctx, info, infoBox, 0.6);
    }
}

window.Overlay = Overlay;
