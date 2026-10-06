// =============================================================================
// TREŚĆ OKNA "O PROJEKCIE" — edytuj ten plik aby zaktualizować treść modalu
// Pole "version" wyznacza też wersję pamięci podręcznej Service Workera (sw.js)
// =============================================================================

window.ABOUT_CONTENT = {
  version: '1.0.1',
  about: {
    description: 'Przeglądarkowy generator plansz testowych i sygnałów fonicznych dla realizacji wizji i dźwięku. Może służyć jako źródło w OBS / vMix (Browser Source) lub działać na fizycznym urządzeniu (np. iPadzie) filmowanym przez kamerę. Zawiera generator sygnału synchronizacji obrazu i dźwięku (lip-sync).',
    copyright: '© Maksymilian Motyka 2026'
  },
  patterns: [
    {
      name: 'Pasy EBU 100/0/75/0',
      description: 'Klasyczne pasy barwne 75% (ITU-R BT.471), znane z europejskich linii kontrolnych'
    },
    {
      name: 'Pasy EBU 100/0/100/0',
      description: 'Pasy barwne 100% (pełna amplituda)'
    },
    {
      name: 'Pasy SMPTE RP 219 (HD)',
      description: 'Wieloformatowe pasy HD/SD z rampą Y i PLUGE (ARIB STD-B28)'
    },
    {
      name: 'Plansza kontrolna',
      description: 'Plansza z okręgiem w stylu Philips PM5544 – geometria, kolor, skala szarości, rozdzielczość'
    },
    {
      name: 'Geometria i strefy bezpieczne',
      description: 'Siatka, okręgi, strefy action / graphics safe wg EBU R 95, wycięcie 4:3, test skalowania 1:1'
    },
    {
      name: 'Skala szarości i PLUGE',
      description: 'Schodki 0–100%, rampa oraz PLUGE do ustawienia czerni monitora'
    },
    {
      name: 'Pełne pole',
      description: 'Jednolity kolor (biel, czerń, szarość, R/G/B) – balans bieli, równomierność ekranu'
    }
  ],
  features: [
    'Ton kontrolny 1 kHz / 997 Hz na poziomie −18 dBFS (EBU R 68) lub −20 dBFS (SMPTE RP 155)',
    'Identyfikacja kanałów: EBU (Tech 3304) i GLITS z obrotowym wskaźnikiem przerw na planszy (?ind=), ton w antyfazie, szum różowy',
    'Synchronizacja A/V: piki dźwiękowe z błyskiem, zbieżnymi znacznikami i licznikiem ms / klatek',
    'Tolerancje lip-sync: EBU R 37, ITU-R BT.1359, ATSC IS-191',
    'Identyfikator źródła: tekst, logo (z czarnym tłem dla obrazów z przezroczystością) lub logo z tekstem (?logo=, ?idmode=)',
    'Parametry adresu ?pattern=, ?audio=, ?ident=, ?kiosk=1 i inne (patrz README)',
    'Klawisz O – panel opcji, F – pełny ekran, ←/→ – zmiana planszy, M – wyciszenie'
  ],
  legal: [
    'Plansze zostały wygenerowane programowo na podstawie publicznie dostępnych norm i opisów (EBU, ITU-R, SMPTE). Plansza kontrolna jest autorską interpretacją układu znanego z generatora Philips PM5544 – nie jest jego kopią.',
    'Ze względu na ograniczenia przeglądarek (8-bitowy RGB w pełnym zakresie, zarządzanie kolorem, skalowanie, opóźnienia wyświetlacza) narzędzie nie zastępuje sprzętowego generatora sygnałów wzorcowych.',
    'Projekt nie jest oficjalnie powiązany z EBU, SMPTE, ITU, Philips ani innymi podmiotami. Wszelkie znaki towarowe należą do ich prawowitych właścicieli.'
  ],
  changelog: [
    {
      version: '1.0.1',
      items: [
        '(1.0.0) Pierwsze wydanie: 7 plansz testowych, identyfikator źródła z tekstem i/lub logo, generator tonów kontrolnych i identyfikacji kanałów (z obrotowym wskaźnikiem przerw), sygnał synchronizacji obrazu i dźwięku.',
        'Poprawa drobnych usterek, dodanie częstotliwości tonu 442 Hz.'
      ]
    }
  ]
};
