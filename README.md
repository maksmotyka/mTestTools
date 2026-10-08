# mTestTools

Przeglądarkowy generator plansz testowych i sygnałów fonicznych dla realizacji wizji i dźwięku. Narzędzie można:
- podać jako źródło w programie realizacyjnym (**OBS** – *Browser Source*, **vMix** – *Web Browser*),
- uruchomić na fizycznym urządzeniu (np. **iPadzie**) i filmować je kamerą – w ten sposób sprawdza się kolor, ekspozycję, ostrość, kadr oraz opóźnienie obrazu względem dźwięku w całym torze: kamera → mikser → enkoder → odbiornik.

Aplikacja nie wymaga instalacji ani serwera – to zwykła strona WWW (HTML + JavaScript), działająca również offline (PWA).

## [▶ Uruchom mTestTools](https://testtools.maksmotyka.xyz/)

## Plansze testowe

| Plansza | Parametr | Do czego służy |
|---|---|---|
| **Pasy EBU 100/0/75/0** | `pattern=ebu75` | Klasyczne europejskie pasy 75% (ITU-R BT.471): biel, żółty, cyjan, zielony, magenta, czerwony, niebieski, czerń. Kontrola poziomów i nasycenia na wektoroskopie / monitorze przebiegów. |
| **Pasy EBU 100/0/100/0** | `pattern=ebu100` | Pasy pełnej amplitudy – kontrola przesterowań chrominancji, ograniczników gamutu. |
| **Pasy SMPTE RP 219 (HD)** | `pattern=rp219` | Wieloformatowe pasy HD/SD (ARIB STD-B28): pasy 75%, szarość 40%, pole *2 (biel 75% / 100% / +I / −I), rampa Y, PLUGE. Na ekranie węższym niż 16:9 rysowana jest część 4:3 – zgodnie z normą jest to obszar wspólny przy konwersji do SD. |
| **Plansza kontrolna** | `pattern=card` | Okrąg w stylu Philips PM5544 (znanej z TVP): siatka geometrii, kastelacja, pasy 75%, kraty rozdzielczości (okres 12/8/6/4/2 px), krzyż centrujący, skala szarości, test odbić/smużenia, widmo barw, pole identyfikatora i zegara. |
| **Geometria i strefy bezpieczne** | `pattern=geometry` | Siatka, okręgi, przekątne, podziałka co 1%, strefy **EBU R 95** (*action safe* 93% i *graphics safe* 90%), wycinek 4:3, pola testu skalowania 1:1 oraz rozdzielczość, w jakiej strona jest faktycznie renderowana. |
| **Skala szarości i PLUGE** | `pattern=gray` | Schodki 0–100% co 10%, rampa (pasmowanie po kompresji), pola przy czerni 1–6% (ustawienie jasności monitora, „zgniatanie” czerni) i przy bieli 94–99% (przepalenia, ustawienie zebry). |
| **Pełne pole** | `pattern=field` | Jednolity kolor: biel 100/75%, szarość 50%, szarość 18% (odbicie), czerń, R/G/B/C/M/Y. Balans bieli kamery, równomierność ekranu, martwe piksele. |

Na każdą planszę można nałożyć **identyfikator** źródła – tekst (np. `KAMERA 2`), **logo** lub logo z tekstem – **zegar** (element ruchomy – pozwala odróżnić żywe źródło od zamrożonej klatki) oraz **opis sygnału audio** (np. `1 kHz −18 dBFS L+R`).

### Logo
Logo wgrywa się przyciskiem **Wgraj logo 🖼️** w panelu opcji (PNG, WebP, JPEG, GIF, SVG z wymiarami) albo podaje parametrem `logo=adres-obrazka`. Opcja **Pokaż** przełącza między samym tekstem, samym logo i logo z tekstem (`idmode=text|logo|both`).
- Obraz z **przezroczystością** (np. logo PNG / WebP z kanałem alfa) jest rysowany na **czarnym tle**; obraz nieprzezroczysty – bez tła.
- Wgrany plik jest pomniejszany (maks. 400 px wysokości) i zapamiętywany w przeglądarce. Nie da się go przekazać w linku – w OBS / vMix wgraj go przez interakcję ze źródłem albo użyj `logo=` z adresem obrazka (np. pliku leżącego obok `index.html`).

### Poziomy w przeglądarce
Przeglądarka rysuje w 8-bitowym RGB w pełnym zakresie. Poziomy z norm są przeliczane: `0% → 0`, `100% → 255`, `75% → 191`. Program realizacyjny zamienia RGB na YCbCr w zakresie studyjnym (`0% → Y 16`, `100% → Y 235`), więc na monitorze przebiegów pasy 75% trafiają w prawidłowe poziomy. **Poziomu −2% z PLUGE (poniżej czerni) nie da się przekazać przez przeglądarkę** – jest przycinany do 0%. Pola +2% i +4% działają normalnie.

## Sygnały foniczne

| Tryb | Parametr | Opis |
|---|---|---|
| **Ton ciągły** | `audio=tone` | Sinus o wybranej częstotliwości i poziomie, na wybranych kanałach. |
| **Identyfikacja EBU** | `audio=ebu` | Ton na obu kanałach, lewy przerywany na 250 ms co 3 s (EBU Tech 3304). |
| **Identyfikacja GLITS** | `audio=glits` | System BBC: lewy kanał przerywany raz, prawy dwukrotnie (250 ms przerwy, 250 ms odstępu) w cyklu 4 s – identyfikuje oba kanały. |
| **Szum różowy** | `audio=pink` | Szum różowy kalibrowany wartością skuteczną (RMS) – odsłuch, zestrojenie głośników, kontrola fazy. |
| **Automatyczny test stereo** | `audio=stereo` | Sekwencja tonu i szumu: L, P, L+P w fazie, L+P w przeciwfazie – z miernikami, korelacją i goniometrem (patrz niżej). |
| **Synchronizacja A/V** | `audio=sync` | Piki tonu zsynchronizowane z grafiką (patrz niżej). |

### Automatyczny test stereo
Wzorowany na dawnych planszach testu stereofonicznego TVP. W pętli odtwarzane są kolejno poniższe kroki. Każdy krok to sygnał (domyślnie 3,5 s) i przerwa (domyślnie 0,5 s) – oba czasy ustawia się w panelu opcji (sekcja **Test stereo**) lub parametrami `stsig=` i `stpause=`:

| | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **Ton** (wybrana częstotliwość) | tylko L | tylko P | L+P w fazie | L+P w przeciwfazie | |
| **Szum różowy** | tylko L | tylko P | L+P w fazie | L+P w przeciwfazie | L i P nieskorelowane |

W ostatnim kroku w lewym i prawym kanale grają dwa **niezależne** szumy – korelacja wynosi 0 (90°), a goniometr pokazuje okrągłą „chmurę”. (Zsumowanie szumu w fazie i w przeciwfazie nie da tego efektu: lewy kanał dostałby 2× szum, a prawy by zaniknął.)

Na planszy pojawia się panel z:
- **miernikami L / P** – wartość szczytowa w dBFS z szybkim opadaniem (60 dB/s – wskazanie gaśnie w przerwie między krokami) i podtrzymaniem szczytu, strefy: do −18 dBFS (poziom odniesienia EBU R 68) zielona, do −9 dBFS (maks. wg EBU R 68) żółta, powyżej czerwona; obok odczyt liczbowy szczytu i wartości skutecznej (RMS),
- **miernikiem korelacji** −1…+1 (180° / 90° / 0°): +1 – sygnał mono, 0 – sygnał tylko w jednym kanale lub kanały niezależne, −1 – przeciwfaza (po zsumowaniu do mono sygnał zaniknie),
- **goniometrem** – obrazem „przestrzeni” stereo: pion to suma M (L+P), poziom to różnica S (L−P); sam lewy kanał daje przekątną `\`, sam prawy `/`, sygnał w fazie – linię pionową, przeciwfaza – poziomą; okrąg oznacza poziom odniesienia −18 dBFS,
- **nazwą bieżącego kroku** i listą wszystkich kroków.

Mierniki, korelacja i goniometr mierzą **faktycznie generowany sygnał** (przed wyciszeniem klawiszem M), więc pokazują to samo, co powinien pokazać miernik na wejściu toru. Ton ma szczyt i RMS −18 dBFS. Szum kalibrowany jest wartością skuteczną (−18 dBFS RMS), a ze względu na przypadkowy charakter jego szczyty leżą 7–8 dB wyżej – na mierniku szczytowym (PPM) sięga ok. −11 dBFS, na mierniku RMS / VU pokazuje −18. To prawidłowe zachowanie.

### Wskaźnik identyfikacji kanałów
Przy identyfikacji EBU i GLITS na planszy pojawia się obrotowy wskaźnik (`ind=corner` – w prawym dolnym rogu, `ind=center` – na środku, `ind=off` – wyłączony):
- **okrąg obraca się raz na cykl** sekwencji (EBU – 3 s, GLITS – 4 s),
- **bloczki** na okręgu to przerwy w tonie: jeden dla EBU (L), trzy dla GLITS (L, P, P); ich długość odpowiada 250 ms przerwy,
- **stała linia na godz. 12** oznacza „teraz”: gdy bloczek wjeżdża na linię, w danym kanale zaczyna się przerwa, gdy z niej zjeżdża – ton wraca; w czasie przerwy linia jest czerwona,
- **lampki L / P** w środku świecą, gdy w kanale brzmi ton.

Wskaźnik korzysta z tego samego zegara audio co dźwięk, a **korekta obrazu** (`offset=`) działa tak samo jak przy synchronizacji A/V. Dzięki temu na podglądzie od razu widać, czy kanały nie są zamienione i czy przerwy w dźwięku pokrywają się z bloczkami.

Poziomy w dBFS odnoszą się do sinusa pełnej skali (AES17):
- **−18 dBFS** – poziom odniesienia **EBU R 68** (odpowiada 0 dBu w torze analogowym), domyślny,
- **−20 dBFS** – poziom odniesienia **SMPTE RP 155** (praktyka amerykańska).

Częstotliwość: domyślnie **1 kHz**; w torach cyfrowych zaleca się **997 Hz**, który nie jest podwielokrotnością typowych częstotliwości próbkowania (każda próbka okresu ma inną wartość).

Kanały: L+P, tylko lewy, tylko prawy oraz **L+P w antyfazie** (prawy odwrócony) – przy poprawnym okablowaniu suma mono takiego sygnału powinna zaniknąć, więc łatwo wykryć odwróconą polaryzację.

## Synchronizacja obrazu i dźwięku (lip-sync)

### Obowiązujące tolerancje

Konwencja: wartość **dodatnia = dźwięk wyprzedza obraz**, ujemna = dźwięk spóźniony.

| Norma | Dźwięk wyprzedza | Dźwięk spóźniony | Zakres |
|---|---|---|---|
| **ATSC IS-191** | +15 ms | −45 ms | cały tor do widza (najostrzejsze) |
| **EBU R 37** | +40 ms | −60 ms | cały tor od studia do nadajnika; każdy etap: +5 / −15 ms |
| **ITU-R BT.1359** – próg wykrywalności | +45 ms | −125 ms | percepcja widza |
| **ITU-R BT.1359** – próg akceptowalności | +90 ms | −185 ms | percepcja widza |

Asymetria wynika z percepcji: dźwięk spóźniony jest naturalny (dźwięk biegnie wolniej niż światło), dźwięk wyprzedzający obraz razi znacznie szybciej.

### Sygnał testowy
Ton (domyślnie 1 kHz, −18 dBFS) odzywa się co **okres** (1–5 s, domyślnie 2 s) i trwa **wybraną długość** (40 ms – 1 s, domyślnie 200 ms). Na planszę nakładany jest panel:

- **BŁYSK** – białe pole (lub cały ekran: `flash=screen`) dokładnie wtedy, gdy brzmi ton – metoda „flash & beep”,
- **TARCZA** – wskazówka obiega tarczę raz na okres; czerwony łuk od **START** do **STOP** pokazuje, kiedy ton się odezwie i kiedy ucichnie,
- **ZNACZNIKI** – dwa trójkąty zbiegają się w środku dokładnie w chwili startu tonu (rozbieg do 1 s),
- **LICZNIK** – czas obrazu względem startu tonu w milisekundach; czytelny na każdej klatce nagrania,
- **LINIJKA ±200 ms** – kursor na tle stref tolerancji EBU R 37, ITU-R BT.1359 i ATSC IS-191,
- **TAŚMA KLATEK** – pole przesuwane o jeden przy każdej wyświetlonej klatce; przeskoki ujawniają gubienie klatek (np. przy filmowaniu ekranu 60 Hz kamerą 50p).

### Jak mierzyć
1. Podaj sygnał (OBS/vMix) lub sfilmuj ekran urządzenia z dźwiękiem z jego głośnika.
2. Nagraj wyjście toru (program, stream, odbiornik).
3. W montażówce znajdź klatkę, w której **zaczyna się ton** na przebiegu audio, i odczytaj **licznik** na tej klatce:
   - `+40 ms` → obraz był już 40 ms po starcie tonu, gdy ton zabrzmiał → **dźwięk spóźniony o 40 ms** (w normie EBU R 37),
   - `−30 ms` → **dźwięk wyprzedza obraz o 30 ms**.
4. To samo można zrobić „na żywo”: kursor linijki w chwili, gdy słychać pik, wskazuje strefę tolerancji.

Analogicznie można zmierzyć **koniec tonu** – na tarczy jest zaznaczony jako STOP, a błysk gaśnie w tej samej chwili.

### Dokładność i kalibracja
Obraz i dźwięk korzystają ze wspólnego zegara `AudioContext`. Moment, w którym próbka faktycznie wychodzi z karty dźwiękowej, aplikacja odczytuje przez `getOutputTimestamp()`, a gdy przeglądarka jej nie obsługuje – z `currentTime` pomniejszonego o raportowane opóźnienie wyjścia (`outputLatency`). Panel opcji pokazuje użytą podstawę czasu i opóźnienia raportowane przez system.

Pozostają czynniki, których przeglądarka nie zna:
- **opóźnienie ekranu** (przetwarzanie obrazu w monitorze/TV, kompozytor systemu – zwykle 1–3 klatki),
- **głośniki Bluetooth / AirPlay** (często 100–250 ms),
- **droga akustyczna** od głośnika do mikrofonu kamery (ok. 3 ms na każdy metr),
- **kwantyzacja do klatek** – ekran 60 Hz pokazuje błysk z dokładnością do ±8 ms, kamera 25p nagrywa z dokładnością do ±20 ms.

Do ich skompensowania służy **Korekta obrazu [ms]** (`offset=`): wartość dodatnia opóźnia grafikę względem dźwięku. Urządzenie warto raz skalibrować – nagrać je kamerą o znanym, poprawnym synchronizmie z bliskiej odległości i ustawić korektę tak, by licznik w chwili startu tonu wskazywał 0.

## Użycie w OBS i vMix

1. Ustaw planszę i dźwięk w panelu **Opcje**, a następnie kliknij **Link do OBS / vMix 🔗** – do schowka trafi adres ze wszystkimi ustawieniami i parametrem `kiosk=1`.
2. **OBS**: *Źródło → Przeglądarka*, wklej adres, ustaw szerokość i wysokość równe rozdzielczości bazowej sceny (np. 1920 × 1080). Aby dźwięk trafił do miksera OBS, zaznacz **„Kontroluj dźwięk przez OBS”**.
3. **vMix**: *Add Input → Web Browser*, wklej adres i ustaw rozdzielczość.

W OBS i vMix dźwięk startuje automatycznie. W zwykłej przeglądarce trzeba raz kliknąć / dotknąć stronę (polityka autoodtwarzania) – przypomina o tym czerwony komunikat.

Plansza **Geometria** pokazuje rzeczywistą rozdzielczość renderowania; jeżeli pola 1:1 w narożnikach nie są ostre, źródło jest skalowane.

## Użycie na iPadzie / telefonie / drugim monitorze

- Najlepiej dodać aplikację do ekranu początkowego (*Udostępnij → Do ekranu początk.*) – uruchomi się na pełnym ekranie i będzie działać offline.
- Przycisk **Opcje** i kursor znikają po 3 s bezczynności; dotknięcie ekranu przywraca przycisk.
- **Przesunięcie palcem w lewo / w prawo** zmienia planszę.
- Aplikacja blokuje wygaszanie ekranu (Screen Wake Lock), a na iPadOS/iOS (Safari 17+) odtwarza dźwięk także przy włączonym przełączniku wyciszenia.
- Przed pomiarami kolorów wyłącz **True Tone**, **Night Shift** i **automatyczną jasność** – zmieniają one barwę i jasność ekranu.

## Parametry adresu

Parametry nadpisują ustawienia zapisane w przeglądarce.

| Parametr | Wartości | Domyślnie |
|---|---|---|
| `pattern` | `ebu75`, `ebu100`, `rp219`, `card`, `geometry`, `gray`, `field` | `ebu75` |
| `sub` | pole *2/*3 RP 219: `75w`, `100w`, `i-plus`, `i-minus` | `75w` |
| `color` | pełne pole: `white`, `white75`, `gray50`, `gray18`, `black`, `red`, `green`, `blue`, `cyan`, `magenta`, `yellow` | `white` |
| `ident` | tekst identyfikatora (do 40 znaków) | – |
| `logo` | adres obrazka z logo | – |
| `idmode` | `text`, `logo`, `both` – co pokazywać jako identyfikator | `text` |
| `clock` | `1` / `0` – zegar | `0` |
| `info` | `1` / `0` – opis sygnału audio | `1` |
| `audio` | `off`, `tone`, `ebu`, `glits`, `pink`, `stereo`, `sync` | `off` |
| `freq` | częstotliwość [Hz], 20–20000 | `1000` |
| `level` | poziom [dBFS], −60…0 | `-18` |
| `ch` | `lr`, `l`, `r`, `anti` | `lr` |
| `period` | okres pików synchronizacji [s], 1–10 | `2` |
| `dur` | długość tonu synchronizacji [ms] (maks. połowa okresu) | `200` |
| `offset` | korekta grafiki synchronizacji, wskaźnika identyfikacji i testu stereo [ms], −2000…2000 | `0` |
| `flash` | `box` (pole na tarczy), `screen` (cały ekran) | `box` |
| `ind` | wskaźnik identyfikacji EBU / GLITS: `corner`, `center`, `off` | `corner` |
| `stsig` | test stereo: czas sygnału w kroku [s], 0,5–30 | `3.5` |
| `stpause` | test stereo: przerwa między krokami [s], 0–10 | `0.5` |
| `kiosk` | `1` – ukrywa przycisk opcji i podpowiedzi | – |

Przykład – pasy EBU z identyfikacją kanałów EBU i podpisem źródła:
```
index.html?pattern=ebu75&audio=ebu&ident=WÓZ%20REPORTERSKI&kiosk=1
```

## Skróty klawiszowe

| Klawisz | Działanie |
|---|---|
| `O` | otwarcie / zamknięcie panelu opcji |
| `Esc` | zamknięcie panelu |
| `←` / `→` | poprzednia / następna plansza |
| `F` | pełny ekran |
| `M` | wyciszenie dźwięku |

## Struktura plików

```
mTestTools/
├── index.html                    # Główny plik HTML
├── manifest.json                 # Manifest PWA
├── sw.js                         # Service Worker (działanie offline)
├── css/common.css                # Style interfejsu
├── assets/                       # Ikony
└── js/
    ├── about-content.js          # Treść okna "O projekcie" i numer wersji
    ├── app.js                    # Ustawienia, panel opcji, pętla rysowania
    ├── audio-engine.js           # Tony, identyfikacja kanałów, szum, piki, zegar audio
    ├── av-sync.js                # Grafika synchronizacji A/V
    ├── ident-indicator.js        # Obrotowy wskaźnik identyfikacji EBU / GLITS
    ├── stereo-test.js            # Automatyczny test stereo: mierniki, korelacja, goniometr
    ├── overlay.js                # Identyfikator, zegar, opis sygnału
    └── patterns/
        ├── pattern-utils.js      # Przeliczanie poziomów, rysowanie pól
        ├── ebu-bars.js           # Pasy EBU 75% / 100%
        ├── smpte-rp219.js        # Pasy SMPTE RP 219
        ├── test-card.js          # Plansza kontrolna
        ├── geometry.js           # Geometria i strefy bezpieczne
        ├── grayscale.js          # Skala szarości i PLUGE
        └── full-field.js         # Pełne pole
```

Nowa plansza to plik w `js/patterns/` rejestrujący obiekt w `window.TestPatterns` (`name`, opcjonalne `options`, funkcja `draw(ctx, w, h, opts)`), dopisany do `index.html`, `sw.js` i listy `patternOrder` w `js/app.js`.

Wersja pamięci podręcznej Service Workera pochodzi z pola `version` w `js/about-content.js` – po jego zmianie przeglądarki pobiorą nowe pliki automatycznie.

## Normy i źródła

- **EBU R 37** – *The relative timing of the sound and vision components of a television signal*
- **ITU-R BT.1359** – *Relative timing of sound and vision for broadcasting*
- **ATSC IS-191** – *Relative Timing of Sound and Vision for Television Broadcast Operations*
- **ITU-R BT.471** – nazewnictwo sygnałów pasów barwnych
- **SMPTE RP 219** – *High-Definition, Standard-Definition Compatible Color Bar Signal*
- **EBU R 95** – *Safe areas for 16:9 television production*
- **EBU R 68** – *Alignment level in digital audio production equipment and recorders*
- **EBU Tech 3304** – *Multichannel line-up tones* (identyfikacja EBU, BLITS)
- **SMPTE RP 155** – poziom odniesienia −20 dBFS

## Ograniczenia
Narzędzie nie zastępuje sprzętowego generatora sygnałów wzorcowych: przeglądarka pracuje w 8-bitowym RGB, może stosować zarządzanie kolorem systemu, a obraz przechodzi przez kompozytor systemu operacyjnego. Do kontroli toru, identyfikacji źródeł, ustawienia kamer i pomiarów synchronizacji z dokładnością do klatki sprawdza się jednak bardzo dobrze.

## Kontakt
Uwagi, zgłoszenia błędów i pomysły: [hello@maksmotyka.xyz](mailto:hello@maksmotyka.xyz)

## Licencja
MIT – patrz [LICENSE](LICENSE).
