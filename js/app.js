// =============================================================================
// GŁÓWNY MODUŁ APLIKACJI - plansze, nakładki, dźwięk, panel opcji
// =============================================================================

class TestToolsApp {
    constructor() {
        this.VERSION = null;
        this.aboutContent = null;

        this.patternOrder = ['ebu75', 'ebu100', 'rp219', 'card', 'geometry', 'gray', 'field']
            .filter(id => window.TestPatterns[id]);

        const oneOf = (...values) => (v) => values.includes(v);
        // Ustawienia: wartość domyślna, nazwa parametru w adresie, walidacja
        this.schema = {
            pattern: { def: 'ebu75', url: 'pattern', valid: (v) => this.patternOrder.includes(v) },
            rp219Sub: { def: '75w', url: 'sub', valid: oneOf('75w', '100w', 'i-plus', 'i-minus') },
            fieldColor: { def: 'white', url: 'color', valid: oneOf('white', 'white75', 'gray50', 'gray18', 'black', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow') },
            ident: { def: '', url: 'ident', type: 'text' },
            identMode: { def: 'text', url: 'idmode', valid: oneOf('text', 'logo', 'both') },
            clock: { def: false, url: 'clock', type: 'bool' },
            audioInfo: { def: true, url: 'info', type: 'bool' },
            audio: { def: 'off', url: 'audio', valid: oneOf('off', 'tone', 'ebu', 'glits', 'pink', 'sync') },
            freq: { def: 1000, url: 'freq', type: 'num', min: 20, max: 20000 },
            level: { def: -18, url: 'level', type: 'num', min: -60, max: 0 },
            channels: { def: 'lr', url: 'ch', valid: oneOf('lr', 'l', 'r', 'anti') },
            syncPeriod: { def: 2, url: 'period', type: 'num', min: 1, max: 10 },
            syncDuration: { def: 200, url: 'dur', type: 'num', min: 20, max: 2000 },
            syncOffset: { def: 0, url: 'offset', type: 'num', min: -2000, max: 2000 },
            syncFlash: { def: 'box', url: 'flash', valid: oneOf('box', 'screen') },
            identIndicator: { def: 'corner', url: 'ind', valid: oneOf('off', 'corner', 'center') }
        };

        this.urlParams = new URLSearchParams(window.location.search);
        this.kioskMode = this.urlParams.get('kiosk') === '1';
        this.settings = this.loadSettings();

        this.audio = new AudioEngine();
        this.sync = new AVSyncOverlay(this.audio);
        this.identIndicator = new IdentIndicator(this.audio);
        this.overlay = new Overlay();

        this.hints = {};
        this.logo = null;           // { img, hasAlpha, fromUrl }
        this.overlayDirty = true;
        this.frameMs = 1000 / 60;
        this.lastFrameTs = 0;
        this.idleTimer = null;
        this.wakeLock = null;
    }

    // -------------------------------------------------------------------------
    // Ustawienia: domyślne <- zapisane w przeglądarce <- parametry adresu
    // -------------------------------------------------------------------------
    parseValue(spec, raw) {
        if (raw === null || raw === undefined) return undefined;
        if (spec.type === 'bool') {
            if (raw === true || raw === '1' || raw === 'true') return true;
            if (raw === false || raw === '0' || raw === 'false') return false;
            return undefined;
        }
        if (spec.type === 'num') {
            const n = parseFloat(raw);
            if (!Number.isFinite(n)) return undefined;
            return Math.max(spec.min, Math.min(spec.max, n));
        }
        if (spec.type === 'text') return String(raw).slice(0, 40);
        return spec.valid(raw) ? raw : undefined;
    }

    loadSettings() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('mtt-settings')) || {};
        } catch (e) { /* brak lub uszkodzone ustawienia */ }

        const settings = {};
        for (const [key, spec] of Object.entries(this.schema)) {
            const fromUrl = this.parseValue(spec, this.urlParams.get(spec.url));
            const fromSaved = this.parseValue(spec, saved[key]);
            settings[key] = fromUrl ?? fromSaved ?? spec.def;
        }
        return settings;
    }

    saveSettings() {
        try {
            localStorage.setItem('mtt-settings', JSON.stringify(this.settings));
        } catch (e) { /* np. tryb prywatny */ }
    }

    set(key, value) {
        const parsed = this.parseValue(this.schema[key], value);
        if (parsed === undefined) return;
        this.settings[key] = parsed;
        this.saveSettings();

        if (['pattern', 'rp219Sub', 'fieldColor'].includes(key)) this.renderPattern();
        if (['audio', 'freq', 'level', 'channels', 'syncPeriod', 'syncDuration'].includes(key)) this.applyAudio();
        if (key === 'pattern') this.renderPatternOptions();
        if (key === 'audio') this.updateControlsVisibility();
        this.overlayDirty = true;
        this.updateAudioHint();
    }

    // Link z ustawieniami odbiegającymi od domyślnych (do OBS / vMix)
    buildLink(kiosk = true) {
        const params = new URLSearchParams();
        for (const [key, spec] of Object.entries(this.schema)) {
            const value = this.settings[key];
            if (value === spec.def) continue;
            params.set(spec.url, spec.type === 'bool' ? (value ? '1' : '0') : value);
        }
        // Wgranego pliku nie da się przekazać w adresie - tylko logo z ?logo=
        if (this.logo && this.logo.fromUrl) params.set('logo', this.logo.fromUrl);
        if (kiosk) params.set('kiosk', '1');
        const query = params.toString();
        return window.location.origin + window.location.pathname + (query ? '?' + query : '');
    }

    // -------------------------------------------------------------------------
    // Inicjalizacja
    // -------------------------------------------------------------------------
    async init() {
        this.aboutContent = window.ABOUT_CONTENT || null;
        this.VERSION = this.aboutContent ? this.aboutContent.version : '?';

        if (this.kioskMode) document.body.classList.add('kiosk');

        this.patternCanvas = document.getElementById('pattern');
        this.overlayCanvas = document.getElementById('overlay');
        this.patternCtx = this.patternCanvas.getContext('2d', { alpha: false });
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        // iOS / iPadOS: dźwięk także przy włączonym przełączniku wyciszenia
        try {
            if (navigator.audioSession) navigator.audioSession.type = 'playback';
        } catch (e) { /* nieobsługiwane */ }

        this.audio.init();
        this.applyAudio();

        this.renderControls();
        this.resize();
        this.restoreLogo();
        this.bindEvents();
        this.requestWakeLock();
        this.updateAudioHint();
        this.markActive();

        requestAnimationFrame((ts) => this.loop(ts));
    }

    applyAudio() {
        const s = this.settings;
        // Ton synchronizacji nie dłuższy niż połowa okresu
        const duration = Math.min(s.syncDuration, s.syncPeriod * 500);
        this.audio.setConfig({
            mode: s.audio,
            freq: s.freq,
            level: s.level,
            channels: s.channels,
            syncPeriod: s.syncPeriod,
            syncDuration: duration
        });
    }

    syncConfig() {
        return { ...this.settings, syncDuration: this.audio.config.syncDuration };
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        // iPadOS potrafi zmienić obszar strony bez zdarzenia resize (pasek statusu, obrót)
        if (window.ResizeObserver) {
            new ResizeObserver(() => this.resize()).observe(this.patternCanvas);
        }

        // Odblokowanie dźwięku przy pierwszej interakcji (polityka autoodtwarzania)
        const unlock = () => {
            this.audio.resume().then(() => this.updateAudioHint()).catch(() => {});
            this.requestWakeLock();
        };
        ['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlock));

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.requestWakeLock();
        });

        // Ukrywanie przycisku opcji i kursora po 3 s bezczynności
        ['mousemove', 'touchstart', 'keydown'].forEach(ev =>
            document.addEventListener(ev, () => this.markActive(), { passive: true }));

        // Skróty klawiszowe
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            if (document.getElementById('about-overlay')) return;
            if (e.key === 'Escape') {
                document.activeElement?.blur?.();
                document.getElementById('controls').classList.add('hidden');
                return;
            }
            if (e.target.matches && e.target.matches('input, select, textarea')) return;

            if (e.code === 'KeyO') this.toggleControls();
            else if (e.code === 'KeyF') this.toggleFullscreen();
            else if (e.code === 'KeyM') this.toggleMute();
            else if (e.key === 'ArrowRight') this.stepPattern(1);
            else if (e.key === 'ArrowLeft') this.stepPattern(-1);
        });

        // Gest przesunięcia (iPad / telefon) - zmiana planszy
        let touchStart = null;
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('#controls, #about-overlay')) return;
            const t = e.changedTouches[0];
            touchStart = { x: t.clientX, y: t.clientY };
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!touchStart) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
            touchStart = null;
            if (Math.abs(dx) > 80 && Math.abs(dy) < 60) this.stepPattern(dx < 0 ? 1 : -1);
        }, { passive: true });

        // Statystyki w panelu opcji
        setInterval(() => this.updateStats(), 500);
    }

    markActive() {
        document.body.classList.remove('idle');
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            if (document.getElementById('controls').classList.contains('hidden')) {
                document.body.classList.add('idle');
            }
        }, 3000);
    }

    async requestWakeLock() {
        if (!('wakeLock' in navigator) || this.wakeLock || document.visibilityState !== 'visible') return;
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
        } catch (e) { /* np. brak gestu użytkownika - ponowienie przy kliknięciu */ }
    }

    toggleFullscreen() {
        const doc = document;
        const el = doc.documentElement;
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
            (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
        } else {
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) req.call(el).catch?.(() => {});
        }
    }

    toggleMute() {
        this.audio.setMuted(!this.audio.muted);
        const box = document.getElementById('mute-audio');
        if (box) box.checked = this.audio.muted;
        this.toast(this.audio.muted ? '🔇 Dźwięk wyciszony' : '🔊 Dźwięk włączony');
    }

    stepPattern(dir) {
        const i = this.patternOrder.indexOf(this.settings.pattern);
        const next = this.patternOrder[(i + dir + this.patternOrder.length) % this.patternOrder.length];
        this.set('pattern', next);
        document.getElementById('pattern-selector').value = next;
        if (this.kioskMode || document.getElementById('controls').classList.contains('hidden')) {
            this.toast(window.TestPatterns[next].name);
        }
    }

    // -------------------------------------------------------------------------
    // Rysowanie
    // -------------------------------------------------------------------------
    resize() {
        this.dpr = window.devicePixelRatio || 1;
        // Rozmiar z faktycznie zajmowanego obszaru, nie z window.innerHeight (patrz common.css)
        const rect = this.patternCanvas.getBoundingClientRect();
        const w = Math.round(rect.width * this.dpr);
        const h = Math.round(rect.height * this.dpr);
        if (!w || !h) return;
        if (w === this.patternCanvas.width && h === this.patternCanvas.height && this.patternDrawn) return;
        this.patternDrawn = true;
        for (const canvas of [this.patternCanvas, this.overlayCanvas]) {
            canvas.width = w;
            canvas.height = h;
        }
        this.renderPattern();
    }

    renderPattern() {
        const ctx = this.patternCtx;
        const { width: w, height: h } = this.patternCanvas;
        const pattern = window.TestPatterns[this.settings.pattern];
        ctx.save();
        this.hints = pattern.draw(ctx, w, h, { ...this.settings, dpr: this.dpr }) || {};
        ctx.restore();
        this.overlayDirty = true;
    }

    loop(ts) {
        const delta = ts - this.lastFrameTs;
        if (delta > 4 && delta < 100) this.frameMs += (delta - this.frameMs) * 0.05;
        this.lastFrameTs = ts;

        const syncActive = this.settings.audio === 'sync';
        const identActive = !!AudioEngine.IDENTS[this.settings.audio] && this.settings.identIndicator !== 'off';
        if (syncActive || identActive || this.settings.clock || this.overlayDirty) {
            const ctx = this.overlayCtx;
            const { width: w, height: h } = this.overlayCanvas;
            ctx.clearRect(0, 0, w, h);
            if (syncActive) this.sync.draw(ctx, w, h, ts, this.frameMs, this.syncConfig());
            if (identActive) this.identIndicator.draw(ctx, w, h, ts, this.frameMs, this.settings);
            const centerH = syncActive ? AVSyncOverlay.panelHeight(w, h)
                : identActive ? IdentIndicator.centerSize(h, this.settings.identIndicator)
                : null;
            this.overlay.draw(ctx, w, h, this.hints, this.settings, this.audio.describe(), centerH, this.logo);
            this.overlayDirty = false;
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    // -------------------------------------------------------------------------
    // Logo identyfikatora
    // Źródło: parametr ?logo=adres (pierwszeństwo) lub plik wgrany w panelu opcji,
    // zapisany w przeglądarce jako data URL (po pomniejszeniu - limit pamięci).
    // -------------------------------------------------------------------------
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Nie udało się wczytać obrazu: ' + src.slice(0, 80)));
            img.src = src;
        });
    }

    // Czy obraz ma przezroczyste piksele (logo PNG / WebP z kanałem alfa)
    detectAlpha(img, src) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(img.naturalWidth, 256);
            canvas.height = Math.max(1, Math.round(canvas.width * img.naturalHeight / img.naturalWidth));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] < 250) return true;
            }
            return false;
        } catch (e) {
            // Obraz z innej domeny bez CORS - nie da się odczytać pikseli, ocena po formacie
            return /\.(png|webp|gif|svg)(\?|#|$)/i.test(src);
        }
    }

    async restoreLogo() {
        const urlLogo = this.urlParams.get('logo');
        let stored = null;
        try { stored = localStorage.getItem('mtt-logo'); } catch (e) { /* brak dostępu */ }
        const src = urlLogo || stored;
        if (!src) return;
        try {
            const img = await this.loadImage(src);
            this.setLogo({ img, hasAlpha: this.detectAlpha(img, src), fromUrl: urlLogo || null });
        } catch (e) {
            console.warn(e.message);
        }
    }

    async uploadLogo(file) {
        if (!file) return;
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        let img;
        try {
            img = await this.loadImage(dataUrl);
        } catch (e) {
            this.toast('Nie udało się wczytać obrazu');
            return;
        }
        if (!img.naturalWidth || !img.naturalHeight) {
            this.toast('Obraz nie ma określonych wymiarów (np. SVG bez width/height)');
            return;
        }

        // Pomniejszenie do maks. 400 px wysokości / 1600 px szerokości
        const scale = Math.min(1, 400 / img.naturalHeight, 1600 / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const hasAlpha = this.detectAlpha(img, dataUrl);
        const stored = hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
        const finalImg = await this.loadImage(stored);

        try {
            localStorage.setItem('mtt-logo', stored);
        } catch (e) {
            this.toast('Logo za duże, by je zapamiętać – działa do odświeżenia strony');
        }
        this.setLogo({ img: finalImg, hasAlpha, fromUrl: null });
        // Po wgraniu logo pokaż je od razu (o ile wybrany był sam tekst)
        if (this.settings.identMode === 'text') {
            this.set('identMode', this.settings.ident ? 'both' : 'logo');
            document.getElementById('ident-mode').value = this.settings.identMode;
        }
        this.toast(hasAlpha ? 'Wczytano logo (z przezroczystością – czarne tło)' : 'Wczytano logo');
    }

    removeLogo() {
        try { localStorage.removeItem('mtt-logo'); } catch (e) { /* brak dostępu */ }
        this.setLogo(null);
    }

    setLogo(logo) {
        this.logo = logo;
        this.overlayDirty = true;
        this.updateLogoControls();
    }

    updateLogoControls() {
        const modeLabel = document.getElementById('ident-mode-label');
        if (!modeLabel) return;
        modeLabel.style.display = this.logo ? '' : 'none';
        document.getElementById('logo-remove').style.display = this.logo ? '' : 'none';
        document.getElementById('logo-status').textContent = !this.logo ? ''
            : (this.logo.fromUrl ? 'Logo z adresu (?logo=)' : 'Logo z pliku')
              + (this.logo.hasAlpha ? ' · przezroczystość → czarne tło' : '');
    }

    // -------------------------------------------------------------------------
    // Panel opcji
    // -------------------------------------------------------------------------
    toggleControls() {
        document.getElementById('controls').classList.toggle('hidden');
        this.markActive();
    }

    selectHtml(id, options, current) {
        const opts = options.map(([v, label]) =>
            `<option value="${v}" ${String(v) === String(current) ? 'selected' : ''}>${label}</option>`).join('');
        return `<select id="${id}">${opts}</select>`;
    }

    // Lista wartości z dopisaną bieżącą (np. ustawioną parametrem adresu)
    withCurrent(options, current, format) {
        return options.some(([v]) => String(v) === String(current))
            ? options
            : [...options, [current, format(current)]];
    }

    renderControls() {
        const toggle = document.createElement('button');
        toggle.id = 'controls-toggle';
        toggle.textContent = 'Opcje ⚙️';
        toggle.addEventListener('click', () => this.toggleControls());
        document.body.appendChild(toggle);

        const s = this.settings;
        const hz = (f) => f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`;
        const freqOptions = this.withCurrent(
            [40, 100, 440, 442, 997, 1000, 3150, 10000, 15000].map(f => [f, hz(f) + (f === 997 ? ' (cyfrowy)' : f === 1000 ? ' (EBU R 68)' : '')]),
            s.freq, hz);
        const levelOptions = this.withCurrent(
            [[-6, '−6 dBFS'], [-9, '−9 dBFS'], [-12, '−12 dBFS'], [-18, '−18 dBFS (EBU R 68)'], [-20, '−20 dBFS (SMPTE RP 155)'], [-24, '−24 dBFS'], [-30, '−30 dBFS']],
            s.level, (l) => `${l} dBFS`);
        const periodOptions = this.withCurrent([1, 2, 3, 4, 5].map(p => [p, `${p} s`]), s.syncPeriod, (p) => `${p} s`);
        const durOptions = this.withCurrent(
            [[40, '40 ms (1 klatka 25p)'], [100, '100 ms'], [200, '200 ms'], [500, '500 ms'], [1000, '1 s']],
            s.syncDuration, (d) => `${d} ms`);

        const controls = document.getElementById('controls');
        controls.innerHTML = `
            <label><strong>Plansza:</strong>
                ${this.selectHtml('pattern-selector', this.patternOrder.map(id => [id, window.TestPatterns[id].name]), s.pattern)}
            </label>
            <div id="pattern-options"></div>

            <hr>
            <label><strong>Identyfikator:</strong>
                <input type="text" id="ident-input" maxlength="40" placeholder="np. KAMERA 1" value="">
            </label>
            <div class="buttons">
                <button id="logo-upload">Wgraj logo 🖼️</button>
                <button id="logo-remove">Usuń logo</button>
            </div>
            <input type="file" id="logo-file" accept="image/png,image/webp,image/jpeg,image/gif,image/svg+xml" hidden>
            <div class="hint" id="logo-status"></div>
            <label id="ident-mode-label">Pokaż: ${this.selectHtml('ident-mode', [
                ['text', 'Sam tekst'], ['logo', 'Samo logo'], ['both', 'Logo i tekst']
            ], s.identMode)}</label>
            <label><input type="checkbox" id="show-clock" ${s.clock ? 'checked' : ''}> Zegar (czas systemowy)</label>
            <label><input type="checkbox" id="show-audio-info" ${s.audioInfo ? 'checked' : ''}> Opis sygnału audio na planszy</label>

            <hr>
            <label><strong>Dźwięk:</strong>
                ${this.selectHtml('audio-mode', [
                    ['off', 'Wyłączony'],
                    ['tone', 'Ton ciągły'],
                    ['ebu', 'Identyfikacja EBU (Tech 3304)'],
                    ['glits', 'Identyfikacja GLITS (BBC)'],
                    ['pink', 'Szum różowy'],
                    ['sync', 'Synchronizacja A/V (piki + grafika)']
                ], s.audio)}
            </label>
            <div id="audio-options">
                <label id="freq-label">Częstotliwość: ${this.selectHtml('audio-freq', freqOptions, s.freq)}</label>
                <label>Poziom: ${this.selectHtml('audio-level', levelOptions, s.level)}</label>
                <label id="channels-label">Kanały: ${this.selectHtml('audio-channels', [
                    ['lr', 'L + P'], ['l', 'Tylko lewy'], ['r', 'Tylko prawy'], ['anti', 'L + P w antyfazie']
                ], s.channels)}</label>
                <label id="indicator-label">Wskaźnik identyfikacji: ${this.selectHtml('ident-indicator', [
                    ['corner', 'W rogu'], ['center', 'Na środku'], ['off', 'Wyłączony']
                ], s.identIndicator)}</label>
                <label id="offset-label">Korekta obrazu [ms]:
                    <input type="number" id="sync-offset" step="1" min="-2000" max="2000" value="${s.syncOffset}">
                </label>
                <div class="hint" id="offset-hint">Dodatnia wartość opóźnia grafikę względem dźwięku – np. dla głośnika Bluetooth.</div>
                <label><input type="checkbox" id="mute-audio"> Wycisz (klawisz M)</label>
            </div>

            <div id="sync-options">
                <hr>
                <strong>Synchronizacja A/V</strong>
                <label>Okres: ${this.selectHtml('sync-period', periodOptions, s.syncPeriod)}</label>
                <label>Długość tonu: ${this.selectHtml('sync-duration', durOptions, s.syncDuration)}</label>
                <label>Błysk: ${this.selectHtml('sync-flash', [['box', 'Pole na tarczy'], ['screen', 'Cały ekran']], s.syncFlash)}</label>
            </div>

            <hr>
            <div id="stats"></div>
            <div class="buttons">
                <button id="fullscreen-button">Pełny ekran ⛶</button>
                <button id="copy-link-button">Link do OBS / vMix 🔗</button>
            </div>
            <div class="buttons">
                <button id="about-button">O projekcie ℹ️</button>
            </div>
        `;

        // Tekst identyfikatora wstawiany jako wartość (nie HTML)
        document.getElementById('ident-input').value = s.ident;

        const bind = (id, key, ev = 'change', read = (el) => el.value) => {
            document.getElementById(id).addEventListener(ev, (e) => this.set(key, read(e.target)));
        };
        bind('pattern-selector', 'pattern');
        bind('ident-input', 'ident', 'input');
        bind('ident-mode', 'identMode');
        const fileInput = document.getElementById('logo-file');
        document.getElementById('logo-upload').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            this.uploadLogo(fileInput.files[0]);
            fileInput.value = '';
        });
        document.getElementById('logo-remove').addEventListener('click', () => this.removeLogo());
        bind('show-clock', 'clock', 'change', (el) => el.checked);
        bind('show-audio-info', 'audioInfo', 'change', (el) => el.checked);
        bind('audio-mode', 'audio');
        bind('audio-freq', 'freq');
        bind('audio-level', 'level');
        bind('audio-channels', 'channels');
        bind('sync-period', 'syncPeriod');
        bind('sync-duration', 'syncDuration');
        bind('sync-flash', 'syncFlash');
        bind('sync-offset', 'syncOffset', 'input');
        bind('ident-indicator', 'identIndicator');

        document.getElementById('mute-audio').addEventListener('change', (e) => this.audio.setMuted(e.target.checked));
        document.getElementById('fullscreen-button').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('copy-link-button').addEventListener('click', () => this.copyLink());
        document.getElementById('about-button').addEventListener('click', () => this.showAbout());

        this.renderPatternOptions();
        this.updateControlsVisibility();
        this.updateLogoControls();
    }

    renderPatternOptions() {
        const container = document.getElementById('pattern-options');
        const pattern = window.TestPatterns[this.settings.pattern];
        container.innerHTML = (pattern.options || []).map(opt =>
            `<label>${opt.label}: ${this.selectHtml('popt-' + opt.key, opt.values, this.settings[opt.key])}</label>`
        ).join('');
        for (const opt of pattern.options || []) {
            document.getElementById('popt-' + opt.key).addEventListener('change', (e) => this.set(opt.key, e.target.value));
        }
    }

    updateControlsVisibility() {
        const mode = this.settings.audio;
        const show = (id, visible) => { document.getElementById(id).style.display = visible ? '' : 'none'; };
        show('audio-options', mode !== 'off');
        show('sync-options', mode === 'sync');
        show('freq-label', mode !== 'pink');
        const isIdent = !!AudioEngine.IDENTS[mode];
        show('channels-label', !isIdent);
        show('indicator-label', isIdent);
        show('offset-label', isIdent || mode === 'sync');
        show('offset-hint', isIdent || mode === 'sync');
    }

    updateStats() {
        const el = document.getElementById('stats');
        if (!el || document.getElementById('controls').classList.contains('hidden')) return;
        const info = this.audio.latencyInfo();
        const ms = (v) => (typeof v === 'number' ? `${(v * 1000).toFixed(1)} ms` : 'b.d.');
        const timebase = {
            outputTimestamp: 'zegar wyjścia audio (getOutputTimestamp)',
            currentTime: 'zegar audio − opóźnienie wyjścia',
            performance: 'zegar przeglądarki (audio nieaktywne)'
        }[this.audio.timebase];
        el.innerHTML = `
            Odświeżanie: <strong>${(1000 / this.frameMs).toFixed(1)} Hz</strong> ·
            obraz ${this.patternCanvas.width}×${this.patternCanvas.height}<br>
            ${info ? `Audio: ${info.state}, ${info.sampleRate} Hz, opóźnienie wyjścia ${ms(info.outputLatency)}, bufor ${ms(info.baseLatency)}<br>` : ''}
            ${this.settings.audio === 'sync' ? `Podstawa czasu: ${timebase}` : ''}
        `;
    }

    updateAudioHint() {
        const hint = document.getElementById('audio-hint');
        const needed = this.settings.audio !== 'off' && !this.audio.isRunning();
        hint.classList.toggle('hidden', !needed);
    }

    async copyLink() {
        const link = this.buildLink(true);
        try {
            await navigator.clipboard.writeText(link);
            this.toast('Skopiowano link (z ?kiosk=1)');
        } catch (e) {
            window.prompt('Skopiuj link:', link);
        }
    }

    toast(text) {
        let el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('visible');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.classList.remove('visible'), 1800);
    }

    // -------------------------------------------------------------------------
    // Okno "O projekcie"
    // -------------------------------------------------------------------------
    showAbout() {
        const c = this.aboutContent;
        const overlay = document.createElement('div');
        overlay.id = 'about-overlay';
        const h3 = (text) => `<h3>${text}</h3>`;
        const li = (items) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

        const entry = c ? c.changelog.find(e => e.version === this.VERSION) : null;
        const changelogSection = entry ? h3(`Co nowego w wersji ${entry.version}`) + li(entry.items) : '';
        const patternsSection = c ? li(c.patterns.map(p => `<strong>${p.name}</strong> – ${p.description}`)) : '';
        const featuresSection = c ? li(c.features.map(f => f.replace(/\?(\S+=)/g, '<code>?$1</code>'))) : '';
        const legalSection = c ? c.legal.map(p => `<p class="small">${p}</p>`).join('') : '';

        overlay.innerHTML = `
            <div class="about-modal">
                <h2><img src="assets/favicon-32x32.png" alt=""> mTestTools</h2>
                <div class="version"><strong>Wersja:</strong> ${this.VERSION}</div>
                ${changelogSection}
                ${h3('O projekcie')}
                <p>${c ? c.about.description : ''}</p>
                ${h3('Plansze testowe')}
                ${patternsSection}
                ${h3('Funkcje')}
                ${featuresSection}
                ${h3('Prawa autorskie i licencja')}
                ${legalSection}
                <p class="small center">${c ? c.about.copyright : ''}</p>
                <div class="center"><button id="close-about">Zamknij</button></div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        };
        const escHandler = (e) => { if (e.key === 'Escape') close(); };
        document.getElementById('close-about').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', escHandler);
    }
}

window.TestToolsApp = TestToolsApp;
