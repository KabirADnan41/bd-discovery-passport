import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useDiscoveryState } from '../../hooks/useDiscoveryState';
import { useAccount } from '../../hooks/useAccount';
import { useTheme } from '../../hooks/useTheme';
import { usePresence } from '../../hooks/usePresence';
import { usePassportSync } from '../../hooks/usePassportSync';
import { DISTRICT_IDS, FEATURED_IDS, MAP, TOTAL_DISTRICTS, getDistrict, getDistrictDetails } from '../../lib/districtData';
import { clearQuizBest, loadDiscovered, loadQuizBest, saveQuizBest } from '../../lib/discoveryStorage';
import { addDay, addStop, clearTrip, createTrip, hasStop, loadTrip, saveTrip, tripMapData } from '../../lib/trip';
import { ROUND_SIZE, createRound, feedbackText, guess, next, promptText, quizMarks, totalScore } from '../../lib/quiz';
import { clearStamps, errorMessage } from '../../lib/authClient';
import BangladeshMap from '../map/BangladeshMap';
import MapLegend from '../map/MapLegend';
import DistrictCard from '../district/DistrictCard';
import DistrictIndex from '../district/DistrictIndex';
import PassportStamp from '../district/PassportStamp';
import DiscoveryProgress, { DiscoveryLedger } from './DiscoveryProgress';
import QuizPanel from './QuizPanel';
import TripPanel from '../trip/TripPanel';
import ConfirmDialog from '../ui/ConfirmDialog';
import PassportMenu from '../account/PassportMenu';
import AuthDialog from '../account/AuthDialog';
import DeleteAccountDialog from '../account/DeleteAccountDialog';

const MASTHEAD_H = '3.5rem';
const GUTTERS = 'px-4 sm:px-6 lg:px-10 min-[90rem]:px-16';
const EYEBROW = 'text-eyebrow text-brass uppercase';
const isKeyboard = e => e.detail === 0; // click events synthesized from Enter/Space have detail 0
const focusMap = () => document.querySelector('[data-district-id][tabindex="0"]')?.focus(); // the map's single tab stop
const placeStop = id => ({ kind: 'place', id }); // how a place is stored in a trip
const MAP_SECTION_ID = 'map-section'; // where a phone's "Show on map" goes

// Scrolls an element to the top of the screen (without animation if the user prefers reduced motion), then focuses it, with no second scroll.
function scrollToAndFocus(element) {
  if (!element) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  element.focus({ preventScroll: true });
}

export default function GameBoard() {
  const theme = useTheme();
  // The passport starts 'pending' (nothing saved locally) until we know whether this browser is signed in.
  const { discovered, discoveredSet, selectedId, justDiscoveredId, source, activate, load, close, reset } = useDiscoveryState();
  const sync = usePassportSync(discovered, source);
  const account = useAccount({
    onRestored: serverIds => {
      sync.restart(serverIds);
      load('account', serverIds);
    },
    onGuest: () => load('guest'),
  });
  const signedIn = source === 'account';

  const [hoveredId, setHoveredId] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [authMode, setAuthMode] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetState, setResetState] = useState({ open: false, busy: false, error: '' });
  const [round, setRound] = useState(null); // the quiz round; null means explore or plan mode
  const [planMode, setPlanMode] = useState(false); // the trip planner; never on during a quiz round
  const [quizBest, setQuizBest] = useState(null);
  const [trip, setTrip] = useState(() => loadTrip()); // read once; nothing is written until the first stop is added
  const [mapReturnDay, setMapReturnDay] = useState(null); // phones: the day whose "Show on map" button the user jumped from, until they go back to it
  const [clearOpen, setClearOpen] = useState(false);
  const [asking, setAsking] = useState('passport'); // what the one ConfirmDialog asks about; it outlives `open`, so a closing dialog keeps its words
  const quizMode = round !== null;
  const mode = quizMode ? 'quiz' : planMode ? 'plan' : 'explore';
  const marks = useMemo(() => (round ? quizMarks(round) : undefined), [round]);
  const headingRef = useRef(null);
  const sheetRef = useRef(null);
  const mastheadRef = useRef(null);
  const returnFocusRef = useRef(null);
  const focusCardRef = useRef(false);
  const tripFocusRef = useRef(null); // the id to focus once a trip edit has rendered

  const handleActivate = useCallback(
    (id, via) => {
      // Remember where the user came from, so closing the page puts them back there.
      returnFocusRef.current = via === 'keyboard' ? document.activeElement : null;
      focusCardRef.current = via === 'keyboard';
      const d = getDistrict(id);
      setAnnouncement(
        discoveredSet.has(id)
          ? `${d.name} passport page open.`
          : `Discovered ${d.name}. ${discoveredSet.size + 1} of ${TOTAL_DISTRICTS} districts discovered.`,
      );
      activate(id);
    },
    [activate, discoveredSet],
  );

  const handleClose = useCallback(() => {
    const target = returnFocusRef.current;
    const fallback = selectedId && document.getElementById(`district-${selectedId}`);
    close();
    returnFocusRef.current = null;
    (target?.isConnected ? target : fallback)?.focus();
  }, [close, selectedId]);

  const isInTrip = placeId => hasStop(trip, placeStop(placeId));

  // Every trip edit ends here. A refused change is the same trip, so nothing is saved, announced or focused.
  // A trip left with no stops is forgotten, not saved, so no empty days outlive it (the planner shows days only when there are stops).
  const editTrip = useCallback(
    (nextTrip, message, focusId) => {
      if (nextTrip === trip) return;
      if (nextTrip.days.some(day => day.length > 0)) {
        setTrip(nextTrip);
        saveTrip(nextTrip);
      } else {
        clearTrip();
        setTrip(createTrip());
      }
      if (message) setAnnouncement(message);
      tripFocusRef.current = focusId;
    },
    [trip],
  );

  // The next trip is worked out here, not in a state updater, so each click saves and announces exactly once.
  const handleAddToTrip = place => {
    const stop = placeStop(place.id);
    if (hasStop(trip, stop)) return; // pressing "In your trip" does nothing
    let nextTrip = addStop(trip, stop);
    if (nextTrip === trip) nextTrip = addStop(addDay(trip), stop); // the last day is full: start a new day
    if (!hasStop(nextTrip, stop)) {
      setAnnouncement('Your trip is full.');
      return;
    }
    editTrip(nextTrip, `Added ${place.name.en} to your trip.`);
  };

  const askToClearTrip = () => {
    setAsking('trip');
    setClearOpen(true);
  };

  const confirmClear = () => {
    clearTrip();
    setClearOpen(false);
    setTrip(createTrip());
    setAnnouncement('Trip cleared.');
    tripFocusRef.current = 'trip-title'; // the button that opened the dialog goes with the stops
  };

  // On a phone the map sits below the planner: "Show on map" jumps to it and remembers the day, so "Back to day" can return to that button.
  // The button is on screen before the scroll: added after it, above the map, it would make the browser scroll on to keep the map still.
  const showDayOnMap = day => {
    flushSync(() => setMapReturnDay(day));
    scrollToAndFocus(document.getElementById(MAP_SECTION_ID));
  };

  const backToDay = () => {
    scrollToAndFocus(document.getElementById(`trip-show-map-${mapReturnDay}`) ?? document.getElementById('trip-title')); // the heading, if that day has no stops now
    setMapReturnDay(null);
  };

  // Quiz mode: choosing a district is a guess. It never opens a passport page or adds a stamp.
  const handleGuess = useCallback(
    id => {
      const r = guess(round, id);
      if (r === round) return;
      setRound(r);
      setAnnouncement(feedbackText(r));
    },
    [round],
  );

  const startRound = () => {
    close();
    setPlanMode(false);
    const r = createRound(DISTRICT_IDS);
    setRound(r);
    setAnnouncement(promptText(r));
  };

  const nextPrompt = () => {
    const r = next(round);
    setRound(r);
    if (r.index < ROUND_SIZE) {
      setAnnouncement(promptText(r));
      focusMap();
      return;
    }
    const best = Math.max(loadQuizBest(), totalScore(r));
    saveQuizBest(best);
    setQuizBest(best);
  };

  const backToExplore = () => {
    setRound(null); // abandons a round without asking
    setPlanMode(false);
    setAnnouncement('Explore mode.');
  };

  // Plan mode is explore mode with the planner as its side panel. On desktop the planner and an open passport page share
  // one column, so an open page closes and the planner shows.
  const startPlan = () => {
    close();
    setRound(null); // abandons a round without asking, as explore does
    setMapReturnDay(null); // a jump to the map from an earlier visit to the planner is forgotten
    setPlanMode(true);
    setAnnouncement('Plan mode.');
  };

  const clearBest = () => {
    clearQuizBest();
    setQuizBest(null);
    setAnnouncement('Best score cleared.');
  };

  // The open passport page lives in the URL, so it can be shared and survives a reload.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set('district', selectedId);
    else url.searchParams.delete('district');
    window.history.replaceState(null, '', url);
    document.title = selectedId ? `${getDistrict(selectedId).name} | Bangladesh Discovery Passport` : 'Bangladesh Discovery Passport';
  }, [selectedId]);

  // After a keyboard activation, move focus into the passport page.
  useEffect(() => {
    if (selectedId && focusCardRef.current) {
      focusCardRef.current = false;
      headingRef.current?.focus();
    }
  }, [selectedId]);

  // A planner edit can replace the focused button (a moved stop re-renders, a removed one is gone), so focus moves by id once
  // the trip has rendered. GameBoard's effects run after its children's, so after "Clear trip" the dialog has closed by now.
  useEffect(() => {
    const id = tripFocusRef.current;
    tripFocusRef.current = null;
    if (id) document.getElementById(id)?.focus();
  }, [trip]);

  // On small screens the page is a bottom sheet: scroll so the chosen district stays visible above it.
  useEffect(() => {
    if (!selectedId || !window.matchMedia('(max-width: 1023px)').matches) return;
    const path = document.getElementById(`district-${selectedId}`);
    const sheet = sheetRef.current;
    if (!path || !sheet) return;
    const r = path.getBoundingClientRect();
    const visibleBottom = window.innerHeight - sheet.getBoundingClientRect().height;
    const mastheadBottom = mastheadRef.current?.getBoundingClientRect().bottom ?? 0;
    const centre = r.top + r.height / 2;
    if (centre > visibleBottom - 24 || centre < mastheadBottom + 24) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: centre - (mastheadBottom + visibleBottom) / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [selectedId]);

  // Escape closes the passport page, unless a layer above it (menu or dialog) is open and handles Escape itself.
  useEffect(() => {
    if (!selectedId || menuOpen || resetState.open || clearOpen || authMode || deleteOpen) return undefined;
    const onKey = e => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, menuOpen, resetState.open, clearOpen, authMode, deleteOpen, handleClose]);

  const backToGuest = () => {
    close(); // the open page belongs to the account; don't carry it into the guest passport
    sync.restart();
    load('guest', loadDiscovered(DISTRICT_IDS));
  };

  const handleAuth = async (mode, username, password, mergeGuest, hpNote) => {
    const merge = mergeGuest ? [...discovered] : []; // exactly the stamps the dialog promised to bring along
    const r = await account.authenticate(mode, username, password, hpNote);
    if (r.ok) {
      const serverIds = r.data.discovered;
      sync.restart(serverIds, merge);
      load('account', [...serverIds, ...merge.filter(id => !serverIds.includes(id))]); // sync uploads the new ones
      setAuthMode(null);
      setAnnouncement(`Signed in as ${r.data.username}.`);
    }
    return r;
  };

  const handleSignOut = async () => {
    const r = await account.signOut();
    if (r.ok) {
      backToGuest();
      setAnnouncement('Signed out.');
    } else {
      setAnnouncement(errorMessage(r));
    }
  };

  const handleDelete = async password => {
    const r = await account.remove(password);
    if (r.ok) {
      setDeleteOpen(false);
      backToGuest();
      setAnnouncement('Your account has been deleted.');
    }
    return r;
  };

  const confirmReset = async () => {
    if (signedIn) {
      setResetState(s => ({ ...s, busy: true, error: '' }));
      sync.restart(); // uploads still in flight from before the reset are ignored
      const r = await clearStamps();
      if (!r.ok) {
        setResetState({ open: true, busy: false, error: errorMessage(r) });
        return;
      }
    }
    setResetState({ open: false, busy: false, error: '' });
    reset();
    setAnnouncement('Passport reset. All stamps cleared.');
  };

  // The card stays mounted briefly after closing so the mobile sheet can slide back down.
  const [shownId, cardExiting] = usePresence(selectedId, 220);
  const details = shownId ? getDistrictDetails(shownId) : null;
  const recent = discovered.slice(-6).reverse();
  const guestCount = signedIn ? 0 : discovered.length;
  // The mode's panel holds the desktop right column: always in a quiz, and in plan mode while no passport page is open.
  const panelHoldsColumn = quizMode || (planMode && !selectedId);
  // Plan mode draws the trip on the map once it has a stop; explore and quiz never do.
  const tripMap = mode === 'plan' ? tripMapData(trip) : null;
  const tripOnMap = tripMap?.pins.length > 0;

  // What the one ConfirmDialog shows for each question it can ask.
  const dialogs = {
    trip: {
      open: clearOpen,
      title: 'Clear your trip?',
      body: 'This removes every stop and day from this browser. It cannot be undone.',
      confirmLabel: 'Clear trip',
      cancelLabel: 'Keep my trip',
      onConfirm: confirmClear,
      onCancel: () => setClearOpen(false),
    },
    passport: {
      open: resetState.open,
      title: 'Reset your passport?',
      body: `This removes all ${discovered.length} stamps ${signedIn ? 'from your account' : 'from this browser'}. It cannot be undone.`,
      confirmLabel: 'Clear all stamps',
      cancelLabel: 'Keep my stamps',
      busy: resetState.busy,
      error: resetState.error,
      onConfirm: confirmReset,
      onCancel: () => setResetState({ open: false, busy: false, error: '' }),
    },
  };
  const { body, ...dialog } = dialogs[asking];

  return (
    <div className="relative min-h-[100dvh] bg-canvas text-ink" data-mode={mode} style={{ '--masthead-h': MASTHEAD_H }}>
      <div className="paper-grain" aria-hidden="true" />
      <a
        href="#district-index"
        hidden={quizMode}
        className="sr-only z-50 rounded-[8px] bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to the list of districts
      </a>

      {/* one quiet strip: title, then the mode switch (centred on desktop, its own row on phones), then progress and menu */}
      <header ref={mastheadRef} className="relative z-10 border-b border-rule">
        <div
          className={`mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 lg:h-[var(--masthead-h)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-6 ${GUTTERS}`}
        >
          <div className="flex min-h-[3.25rem] min-w-0 flex-wrap items-baseline content-center gap-x-2.5">
            <h1 translate="no" className="text-[1rem] leading-[1.15] font-[650] tracking-[-0.005em]">
              Bangladesh <span className="whitespace-nowrap">Discovery Passport</span>
            </h1>
            <p lang="bn" className="hidden truncate text-[1rem] leading-tight text-ink-3 sm:block">
              বাংলাদেশ আবিষ্কারের পাসপোর্ট
            </p>
          </div>
          <fieldset className="mode-switch col-span-2 row-start-2 pb-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:pb-0">
            <legend className="sr-only">Mode</legend>
            <div className="grid grid-cols-3 gap-1 lg:w-[21rem]">
              <label className="theme-option">
                <input type="radio" name="mode" checked={mode === 'explore'} onChange={backToExplore} className="sr-only" />
                <span className="px-4 leading-tight">
                  Explore
                  <span lang="bn" className="text-[0.75rem] leading-[1.3] font-normal">
                    ঘুরে দেখুন
                  </span>
                </span>
              </label>
              <label className="theme-option">
                <input type="radio" name="mode" checked={quizMode} onChange={startRound} className="sr-only" />
                <span className="px-4 leading-tight">
                  Quiz
                  <span lang="bn" className="text-[0.75rem] leading-[1.3] font-normal">
                    কুইজ
                  </span>
                </span>
              </label>
              <label className="theme-option">
                <input type="radio" name="mode" checked={planMode} onChange={startPlan} className="sr-only" />
                <span className="px-4 leading-tight">
                  Plan
                  <span lang="bn" className="text-[0.75rem] leading-[1.3] font-normal">
                    পরিকল্পনা
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <div className="col-start-2 row-start-1 flex items-center gap-3 justify-self-end sm:gap-5 lg:col-start-3">
            <DiscoveryProgress count={discovered.length} total={TOTAL_DISTRICTS} />
            <PassportMenu
              account={account}
              sync={sync.status}
              theme={theme}
              onOpenChange={setMenuOpen}
              discoveredCount={discovered.length}
              onOpenAuth={setAuthMode}
              onSignOut={handleSignOut}
              onDeleteAccount={() => setDeleteOpen(true)}
              onReset={() => {
                setAsking('passport');
                setResetState({ open: true, busy: false, error: '' });
              }}
            />
          </div>
        </div>
      </header>

      <main className="relative z-[1]">
        <div
          className={`mx-auto flex max-w-[1400px] flex-col lg:grid lg:min-h-[calc(100dvh-var(--masthead-h))] lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(360px,500px)] ${GUTTERS}`}
        >
          {/* on phones the quiz prompt or the planner sits above the map (first in the DOM too, so focus order matches), so
              the question stays in view while you tap; on desktop it moves to the right column */}
          {(quizMode || planMode) && (
            <div className={`pt-4 lg:order-last lg:flex lg:min-h-0 lg:flex-col lg:justify-center lg:py-5 ${panelHoldsColumn ? '' : 'lg:hidden'}`}>
              {quizMode ? (
                <QuizPanel
                  round={round}
                  best={quizBest}
                  onNext={nextPrompt}
                  onPlayAgain={() => {
                    startRound();
                    focusMap();
                  }}
                  onExplore={() => {
                    backToExplore();
                    focusMap();
                  }}
                  onClearBest={clearBest}
                />
              ) : (
                <TripPanel trip={trip} onEdit={editTrip} onClear={askToClearTrip} onShowOnMap={showDayOnMap} />
              )}
            </div>
          )}

          {/* focusable, so a phone's "Show on map" can land here; a name, so a screen reader says where focus went */}
          <section id={MAP_SECTION_ID} tabIndex={-1} aria-label="Map" className="flex flex-col items-center py-4 lg:py-5">
            {mode === 'plan' && mapReturnDay !== null && (
              // a wrapper hides it on desktop, as in the planner: .btn's own display would win over lg:hidden on the button
              <div className="mb-3 self-start lg:hidden">
                <button type="button" className="btn btn-quiet" onClick={backToDay}>
                  Back to day {mapReturnDay}
                </button>
              </div>
            )}
            <BangladeshMap
              discoveredSet={discoveredSet}
              selectedId={selectedId}
              hoveredId={hoveredId}
              marks={marks}
              tripMap={tripOnMap ? tripMap : undefined}
              onHoverChange={setHoveredId}
              onActivate={quizMode ? handleGuess : handleActivate}
            />
            <MapLegend mode={mode} className="mt-3" />
            {tripOnMap && (
              <p className="mt-2 w-full text-[0.85rem] text-ink-3 lg:text-center">
                Pins and lines are approximate. Use each day’s Directions for the real route.
              </p>
            )}
          </section>

          {/* in quiz mode this column holds only a closing phone sheet, so on desktop it leaves the grid to the quiz panel;
              in plan mode it does so too, unless a passport page is open in the planner's place */}
          <div className={panelHoldsColumn ? 'lg:hidden' : 'lg:flex lg:min-h-0 lg:flex-col lg:justify-center lg:py-5'}>
            {details && (
              <DistrictCard
                details={details}
                isNew={!cardExiting && justDiscoveredId === selectedId}
                exiting={cardExiting}
                headingRef={headingRef}
                sheetRef={sheetRef}
                onClose={handleClose}
                onSelect={id => handleActivate(id, 'pointer')}
                isInTrip={isInTrip}
                onAddToTrip={handleAddToTrip}
              />
            )}

            <div className={`pt-6 pb-10 lg:py-0 ${selectedId ? 'lg:hidden' : ''}`} hidden={quizMode || planMode}>
              <h2 className="text-display text-balance">Explore Bangladesh, one district at a time.</h2>
              <p lang="bn" className="mt-4 text-[1.45rem] leading-[1.3] font-medium text-balance text-ink-2 sm:text-[1.65rem]">
                একটি একটি জেলা করে বাংলাদেশকে জানুন।
              </p>
              <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-2">
                Choose a district on the map to open its passport page and collect its stamp.
              </p>

              <p className={`mt-9 ${EYEBROW}`}>Where to begin</p>
              <ul className="place-links mt-1 text-[1.1rem]">
                {FEATURED_IDS.map(id => {
                  const d = getDistrict(id);
                  return (
                    <li key={id}>
                      <button type="button" className="place-link" onClick={e => handleActivate(id, isKeyboard(e) ? 'keyboard' : 'pointer')}>
                        <span>{d.name}</span>
                        <span lang="bn" className="font-normal text-ink-3">
                          {d.bn}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {recent.length > 0 && (
                <>
                  <p className={`mt-8 ${EYEBROW}`}>Your latest stamps</p>
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {recent.map(id => {
                      const d = getDistrictDetails(id);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className="rounded-full p-1 transition-transform duration-150 ease-[var(--ease-out)] motion-safe:hover:-rotate-3 motion-safe:active:scale-95"
                            onClick={e => handleActivate(id, isKeyboard(e) ? 'keyboard' : 'pointer')}
                            aria-label={`Open ${d.name}`}
                          >
                            <PassportStamp id={id} code={d.stampCode} name={d.name} bn={d.bn} division={d.division.name} size={56} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <DiscoveryLedger count={discovered.length} total={TOTAL_DISTRICTS} className="mt-10" />
            </div>
          </div>
        </div>

        {/* the gazetteer would give the answers away, so the quiz hides it */}
        {!quizMode && <DistrictIndex discoveredSet={discoveredSet} selectedId={selectedId} onActivate={handleActivate} />}

        <footer className={`border-t border-rule py-10 text-[0.82rem] leading-relaxed text-ink-3 ${GUTTERS}`}>
          <div className="mx-auto max-w-[1400px]">
            <p>
              Boundaries:{' '}
              <a className="link" href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">
                geoBoundaries
              </a>{' '}
              (gbOpen ADM2 and ADM3, CC BY 4.0; underlying authority BBS and OCHA ROAP), via{' '}
              <a className="link" href="https://github.com/ifahimreza/bangladesh-geojson" target="_blank" rel="noopener noreferrer">
                ifahimreza/bangladesh-geojson
              </a>{' '}
              (MIT). Districts are dissolved from upazila boundaries and simplified for the web.
            </p>
            <p className="mt-2">
              <a className="link" href="/privacy/">
                Privacy notice
              </a>{' '}
              and{' '}
              <a className="link" href="/terms/">
                terms of use
              </a>
              . The map is for learning and play, not an official boundary map.
            </p>
            <p className="mt-2">
              {MAP.meta.projection}. No ads and no tracking. Guests keep stamps in this browser; accounts store only a username, a password
              check and stamps.
            </p>
          </div>
        </footer>
      </main>

      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>
      <p className="sr-only" aria-live="polite">
        {sync.status === 'error' ? 'Some stamps are not saved to your account yet. They will be retried on your next stamp.' : ''}
      </p>

      <AuthDialog mode={authMode} guestCount={guestCount} onSwitchMode={setAuthMode} onSubmit={handleAuth} onClose={() => setAuthMode(null)} />
      <DeleteAccountDialog open={deleteOpen} username={account.username} onDelete={handleDelete} onClose={() => setDeleteOpen(false)} />
      {/* one ConfirmDialog asks both questions, as its title id must be unique in the page */}
      <ConfirmDialog {...dialog}>{body}</ConfirmDialog>
    </div>
  );
}
