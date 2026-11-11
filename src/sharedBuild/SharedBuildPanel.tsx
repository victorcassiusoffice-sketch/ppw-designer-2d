import { useEffect, useState, useSyncExternalStore } from 'react';
import { TRADES } from './contract';
import { joinOrHost, leave, resolveOverlap, resume, snapshot, subscribe } from './client';
import { WALK_CHARACTERS, DEFAULT_WALK_CHARACTER_ID } from '../walk/characters';
import './sharedBuild.css';

export default function SharedBuildPanel({ close }: { close: () => void }) {
  const status = useSyncExternalStore(subscribe, snapshot),
    [trade, setTrade] = useState<string>(TRADES[0]),
    [avatar, setAvatar] = useState(
      () => localStorage.getItem('olb-world-character-v1') || DEFAULT_WALK_CHARACTER_ID,
    ),
    [code, setCode] = useState('');
  useEffect(() => {
    resume();
  }, []);
  return (
    <section
      className="live-build-panel"
      aria-label="Shared build"
      data-testid="shared-build-panel"
    >
      <header>
        <strong>Shared build</strong>
        <button onClick={close} aria-label="Close shared build panel">
          ×
        </button>
      </header>
      {status.joined ? (
        <>
          <span>{status.players.length + 1} connected</span>
          {status.invite && (
            <label>
              Build access code
              <input readOnly value={status.invite} onFocus={(e) => e.target.select()} />
            </label>
          )}
          {status.players.map((player) => (
            <span key={player.id}>
              {player.trade} ·{' '}
              {WALK_CHARACTERS.find((c) => c.id === player.avatar)?.label ?? 'Player'}
            </span>
          ))}
          {status.conflict && (
            <div>
              <button onClick={() => resolveOverlap(false)}>Use team edit</button>
              <button onClick={() => resolveOverlap(true)}>Keep my edit</button>
            </div>
          )}
          <button onClick={() => void leave()}>Leave shared build</button>
        </>
      ) : (
        <>
          <label>
            Job
            <select value={trade} onChange={(e) => setTrade(e.target.value)}>
              {TRADES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Character
            <select value={avatar} onChange={(e) => setAvatar(e.target.value)}>
              {WALK_CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Build access code
            <input
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={80}
            />
          </label>
          <button
            disabled={status.busy || !code.trim()}
            onClick={() => void joinOrHost('join', { trade, avatar }, code)}
          >
            Join build
          </button>
          <button disabled={status.busy} onClick={() => void joinOrHost('host', { trade, avatar })}>
            Host this build
          </button>
        </>
      )}
      <output aria-live="polite">{status.message}</output>
    </section>
  );
}
