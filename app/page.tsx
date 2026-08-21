'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { makeIce, PLAYER_NAMES, resolveHit, type Ice } from './game';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function initialGame(round: number, players: number) {
  return makeIce(players, 20260821 + round * 97 + players * 13);
}

export default function Home() {
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(1);
  const [starter, setStarter] = useState(0);
  const [ice, setIce] = useState<Ice[]>(() => initialGame(1, 2));
  const [player, setPlayer] = useState(0);
  const [move, setMove] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loser, setLoser] = useState<number | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [falling, setFalling] = useState<string[]>([]);
  const remaining = useMemo(() => ice.filter((tile) => tile.state === 'solid').length, [ice]);
  const radius = players;
  const completedCycles = Math.floor((move - 1) / players);

  async function breakIce(id: string) {
    if (busy || loser !== null) return;
    setBusy(true);
    const { final, steps } = resolveHit(ice, id, move, players);

    setFalling([id]);
    setIce((current) => current.map((tile) => tile.id === id ? { ...tile, state: 'gone' } : tile));
    await wait(160);

    for (const step of steps) {
      setFalling([]);
      setPulse(step.affected);
      await wait(190);
      if (step.falling.length) {
        setPulse([]);
        setFalling(step.falling);
        setIce((current) => current.map((tile) => step.falling.includes(tile.id) ? { ...tile, state: 'gone' } : tile));
        await wait(210);
      }
    }

    setIce(final);
    setPulse([]);
    setFalling([]);
    const penguinFell = final.find((tile) => tile.id === '0:0')?.state === 'gone';
    setBusy(false);
    if (penguinFell) setLoser(player);
    else {
      setPlayer((current) => (current + 1) % players);
      setMove((current) => current + 1);
    }
  }

  function restart(nextPlayers = players) {
    if (busy) return;
    const nextRound = round + 1;
    const nextStarter = nextPlayers === players ? (starter + 1) % nextPlayers : 0;
    setPlayers(nextPlayers);
    setRound(nextRound);
    setStarter(nextStarter);
    setIce(initialGame(nextRound, nextPlayers));
    setPlayer(nextStarter);
    setMove(1);
    setLoser(null);
    setPulse([]);
    setFalling([]);
  }

  const boardStyle = { '--ice-size': `${48 / radius}%` } as CSSProperties;
  const penguinSize = radius === 2 ? 60 : radius === 3 ? 48 : 38;

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">QUICK ICE GAME</p>
          <h1>얼음 한 판</h1>
        </div>
        <div className="game-actions">
          <label className="player-select">
            <span>인원</span>
            <select value={players} disabled={busy} onChange={(event) => restart(Number(event.target.value))}>
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명</option>
            </select>
          </label>
          <button className="restart-small" disabled={busy} onClick={() => restart()}>새 게임</button>
        </div>
      </header>

      <section className="status-card" aria-live="polite">
        <div className={`player-dot player-${player}`} />
        <div>
          <span>{loser === null ? `${PLAYER_NAMES[player]} 차례` : `${PLAYER_NAMES[loser]} 패배`}</span>
          <strong>{loser === null ? (busy ? '충격이 퍼집니다…' : '얼음 하나를 고르세요') : '펭귄이 빠졌습니다!'}</strong>
        </div>
        <div className="move-count"><span>타격</span><b>{move}</b></div>
      </section>

      <section className="board-wrap" aria-label={`${players}인용 얼음 게임판`}>
        <div className="cold-meter" aria-label={`한기 단계 ${Math.min(3, Math.floor(completedCycles / 2) + 1)}`}>
          <i style={{ width: `${Math.min(100, 25 + completedCycles * 15)}%` }} />
        </div>
        <div className={`board board-${players}`} style={boardStyle}>
          <div className="water-ripple" />
          {ice.map((tile) => (
            <button
              key={tile.id}
              className={`ice ${tile.state} ${pulse.includes(tile.id) ? 'pulse' : ''} ${falling.includes(tile.id) ? 'falling' : ''}`}
              style={{ left: `${tile.x}%`, top: `${tile.y}%` }}
              onClick={() => breakIce(tile.id)}
              disabled={busy || loser !== null || tile.state === 'gone'}
              aria-label={tile.id === '0:0' ? '펭귄이 있는 얼음' : '얼음'}
            />
          ))}
          <div
            className={`penguin ${ice.find((tile) => tile.id === '0:0')?.state === 'gone' ? 'dropped' : busy ? 'worried' : ''}`}
            style={{ fontSize: `${penguinSize}px` }}
            aria-label="펭귄"
          >🐧</div>
        </div>
        <p className="rule">타격 전에는 균열이 보이지 않습니다. 펭귄을 떨어뜨린 사람이 집니다.</p>
      </section>

      <footer>
        <span>남은 얼음 <b>{remaining}</b></span>
        <span>한기 <b>{completedCycles + 1}</b></span>
        <span>라운드 <b>{round}</b></span>
      </footer>

      {loser !== null && (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <div className="result-card">
            <span className="result-penguin">🐧</span>
            <p>라운드 종료</p>
            <h2 id="result-title">{PLAYER_NAMES[loser]} 패배</h2>
            <span>{move}번의 타격, 약 {Math.max(10, move * 4)}초 만에 끝났어요.</span>
            <button autoFocus onClick={() => restart()}>한 판 더</button>
          </div>
        </div>
      )}
    </main>
  );
}
