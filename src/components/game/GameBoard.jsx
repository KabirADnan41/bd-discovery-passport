import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiscoveryState } from '../../hooks/useDiscoveryState';
import { useAccount } from '../../hooks/useAccount';
import { useTheme } from '../../hooks/useTheme';
import { usePresence } from '../../hooks/usePresence';
import { usePassportSync } from '../../hooks/usePassportSync';
import { DISTRICT_IDS, FEATURED_IDS, MAP, TOTAL_DISTRICTS, getDistrict, getDistrictDetails } from '../../lib/districtData';
import { loadDiscovered } from '../../lib/discoveryStorage';
import { clearStamps, errorMessage } from '../../lib/authClient';
import BangladeshMap from '../map/BangladeshMap';
import MapLegend from '../map/MapLegend';
import DistrictCard from '../district/DistrictCard';
import DistrictIndex from '../district/DistrictIndex';
import PassportStamp from '../district/PassportStamp';
import DiscoveryProgress from './DiscoveryProgress';
import ConfirmDialog from '../ui/ConfirmDialog';
import PassportMenu from '../account/PassportMenu';
import AuthDialog from '../account/AuthDialog';
import DeleteAccountDialog from '../account/DeleteAccountDialog';

const MASTHEAD_H = '4.5rem';
const isKeyboard = e => e.detail === 0; // click events synthesized from Enter/Space have detail 0

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
  const headingRef = useRef(null);
  const sheetRef = useRef(null);
  const mastheadRef = useRef(null);
  const returnFocusRef = useRef(null);
  const focusCardRef = useRef(false);

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
    if (!selectedId || menuOpen || resetState.open || authMode || deleteOpen) return undefined;
    const onKey = e => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, menuOpen, resetState.open, authMode, deleteOpen, handleClose]);

  const backToGuest = () => {
    close(); // the open page belongs to the account; don't carry it into the guest passport
    sync.restart();
    load('guest', loadDiscovered(DISTRICT_IDS));
  };

  const handleAuth = async (mode, username, password, mergeGuest) => {
    const merge = mergeGuest ? [...discovered] : []; // exactly the stamps the dialog promised to bring along
    const r = await account.authenticate(mode, username, password);
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

  return (
    <div className="relative min-h-[100dvh] bg-canvas text-ink" style={{ '--masthead-h': MASTHEAD_H }}>
      <div className="paper-grain" aria-hidden="true" />
      <a
        href="#district-index"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to the list of districts
      </a>

      <header ref={mastheadRef} className="relative z-10 flex h-[var(--masthead-h)] items-center justify-between gap-3 border-b border-rule px-4 sm:gap-6 sm:px-6 lg:px-10">
        <div className="min-w-0">
          <h1 translate="no" className="text-[0.98rem] leading-[1.15] font-semibold tracking-[-0.005em] sm:text-[1.2rem]">
            Bangladesh <span className="whitespace-nowrap">Discovery Passport</span>
          </h1>
          <p lang="bn" className="hidden truncate text-[0.85rem] leading-tight text-ink-3 sm:block">
            বাংলাদেশ আবিষ্কারের পাসপোর্ট
          </p>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <DiscoveryProgress count={discovered.length} total={TOTAL_DISTRICTS} fresh={Boolean(justDiscoveredId)} />
          <PassportMenu
            account={account}
            sync={sync.status}
            theme={theme}
            onOpenChange={setMenuOpen}
            discoveredCount={discovered.length}
            onOpenAuth={setAuthMode}
            onSignOut={handleSignOut}
            onDeleteAccount={() => setDeleteOpen(true)}
            onReset={() => setResetState({ open: true, busy: false, error: '' })}
          />
        </div>
      </header>

      <main className="relative z-[1]">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:grid lg:h-[calc(100dvh-var(--masthead-h))] lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-10 lg:px-10">
          <div className="relative flex justify-center py-4 lg:items-center lg:py-5">
            <BangladeshMap
              discoveredSet={discoveredSet}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onHoverChange={setHoveredId}
              onActivate={handleActivate}
            >
              <MapLegend className="absolute top-[3%] right-0 hidden rounded-[10px] bg-canvas/85 p-3 lg:grid" />
            </BangladeshMap>
          </div>

          <div className="lg:flex lg:min-h-0 lg:flex-col lg:justify-center lg:py-5">
            {details && (
              <DistrictCard
                details={details}
                isNew={!cardExiting && justDiscoveredId === selectedId}
                exiting={cardExiting}
                headingRef={headingRef}
                sheetRef={sheetRef}
                onClose={handleClose}
                onSelect={id => handleActivate(id, 'pointer')}
              />
            )}

            <div className={selectedId ? 'lg:hidden' : ''}>
              <h2 className="text-[1.9rem] leading-[1.1] font-semibold tracking-[-0.01em] text-balance sm:text-[2.3rem]">
                Explore Bangladesh, one district at a time.
              </h2>
              <p lang="bn" className="mt-2 text-[1.2rem] text-ink-2">
                একটি একটি জেলা করে বাংলাদেশকে জানুন।
              </p>
              <p className="mt-4 max-w-[46ch] text-ink-2">Choose a district on the map to open its passport page and collect its stamp.</p>

              <p className="mt-7 text-[0.85rem] font-medium text-ink-3">Where to begin</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {FEATURED_IDS.map(id => {
                  const d = getDistrict(id);
                  return (
                    <li key={id}>
                      <button type="button" className="btn btn-quiet" onClick={e => handleActivate(id, isKeyboard(e) ? 'keyboard' : 'pointer')}>
                        {d.name}
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
                  <p className="mt-8 text-[0.85rem] font-medium text-ink-3">Your latest stamps</p>
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
                            <PassportStamp id={id} code={d.stampCode} name={d.name} bn={d.bn} division={d.division.name} size={64} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <MapLegend className="mt-8 lg:hidden" />
            </div>
          </div>
        </div>

        <DistrictIndex discoveredSet={discoveredSet} selectedId={selectedId} onActivate={handleActivate} />

        <footer className="border-t border-rule px-4 py-10 text-[0.82rem] leading-relaxed text-ink-3 sm:px-6 lg:px-10">
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
      <ConfirmDialog
        open={resetState.open}
        title="Reset your passport?"
        confirmLabel="Clear all stamps"
        cancelLabel="Keep my stamps"
        busy={resetState.busy}
        error={resetState.error}
        onConfirm={confirmReset}
        onCancel={() => setResetState({ open: false, busy: false, error: '' })}
      >
        This removes all {discovered.length} stamps {signedIn ? 'from your account' : 'from this browser'}. It cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
