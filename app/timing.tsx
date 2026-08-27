'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatTiming,
  makeTimingTarget,
  rankTimingResults,
  scoreTimingAttempt,
  type TimingMode,
  type TimingResult,
} from './timing-game';

type Phase = 'setup' | 'ready' | 'running' | 'handoff' | 'result';

const MAX_ATTEMPT_MS = 9990;

function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

export default function TimingGame({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<TimingMode>('blind');
  const [players, setPlayers] = useState(4);
  const [phase, setPhase] = useState<Phase>('setup');
  const [target, setTarget] = useState(3000);
  const [turn, setTurn] = useState(0);
  const [shownMs, setShownMs] = useState(0);
  const [results, setResults] = useState<TimingResult[]>([]);
  const startedAt = useRef(0);
  const stopped = useRef(false);

  const ranked = useMemo(() => rankTimingResults(results), [results]);
  const buyer = ranked.at(-1);
  const modeName = mode === 'blind' ? '감으로 멈춰!' : '보고 멈춰!';

  const recordAttempt = useCallback((elapsed: number) => {
    if (stopped.current) return;
    stopped.current = true;
    const safeElapsed = Math.min(MAX_ATTEMPT_MS, Math.max(0, elapsed));
    setResults((current) => [...current, scoreTimingAttempt(turn, safeElapsed, target)]);
    setPhase(turn + 1 >= players ? 'result' : 'handoff');
  }, [players, target, turn]);

  useEffect(() => {
    if (phase !== 'running') return;
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt.current;
      setShownMs(Math.min(elapsed, MAX_ATTEMPT_MS));
      if (elapsed >= MAX_ATTEMPT_MS) recordAttempt(MAX_ATTEMPT_MS);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, recordAttempt]);

  function startGame() {
    setTarget(makeTimingTarget(secureRandom));
    setTurn(0);
    setShownMs(0);
    setResults([]);
    setPhase('ready');
  }

  function startAttempt() {
    stopped.current = false;
    startedAt.current = performance.now();
    setShownMs(0);
    setPhase('running');
  }

  function stopAttempt() {
    recordAttempt(performance.now() - startedAt.current);
  }

  function nextPlayer() {
    setTurn((current) => current + 1);
    setShownMs(0);
    setPhase('ready');
  }

  function replay() {
    setTarget(makeTimingTarget(secureRandom));
    setTurn(0);
    setShownMs(0);
    setResults([]);
    setPhase('ready');
  }

  return (
    <main className={`timing-shell ${mode === 'blind' ? 'timing-blind' : 'timing-visible'}`}>
      <header className="timing-topbar">
        <div>
          <p className="timing-eyebrow">ONE DEVICE · 2–6 PLAYERS</p>
          <h1>{phase === 'setup' ? '멈춰!' : modeName}</h1>
        </div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="timing-setup">
          <div className="stopwatch-art" aria-hidden="true">
            <i />
            <span>00.00</span>
          </div>
          <div className="timing-copy">
            <p>목표 시간에 가장 가깝게 멈추세요.</p>
            <strong>가장 멀리 벗어난 사람이 커피!</strong>
          </div>

          <div className="timing-mode-grid" aria-label="게임 방식 선택">
            <button className={mode === 'blind' ? 'active' : ''} aria-pressed={mode === 'blind'} onClick={() => setMode('blind')}>
              <span>🙈</span>
              <strong>감으로 멈춰!</strong>
              <small>시작하면 숫자가 사라져요</small>
            </button>
            <button className={mode === 'visible' ? 'active' : ''} aria-pressed={mode === 'visible'} onClick={() => setMode('visible')}>
              <span>👀</span>
              <strong>보고 멈춰!</strong>
              <small>흐르는 시간을 보며 눌러요</small>
            </button>
          </div>

          <label className="timing-player-select">
            <span>참가 인원</span>
            <select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="timing-primary" onClick={startGame}>{modeName} 시작</button>
          <p className="timing-rule">한 명씩 도전하고 기록은 마지막까지 공개되지 않습니다.</p>
        </section>
      )}

      {phase === 'ready' && (
        <section className="timing-center timing-ready">
          <p className="turn-pill">참가자 {turn + 1} / {players}</p>
          <span className="ready-icon" aria-hidden="true">{mode === 'blind' ? '🙈' : '👀'}</span>
          <p>이번 목표</p>
          <strong className="target-time">{formatTiming(target)}<small>초</small></strong>
          <h2>{mode === 'blind' ? '시간을 머릿속으로 세어보세요' : '숫자를 보며 정확히 멈추세요'}</h2>
          <button className="timing-primary timing-start" onClick={startAttempt}>준비됐어요 · 시작</button>
          <small className="handoff-note">휴대폰을 참가자 {turn + 1}에게 건넨 뒤 시작하세요.</small>
        </section>
      )}

      {phase === 'running' && (
        <section className="timing-center timing-running" aria-live="off">
          <p className="turn-pill">참가자 {turn + 1} · 목표 {formatTiming(target)}초</p>
          <div className="timer-orbit" aria-label={mode === 'blind' ? '시간을 숨긴 채 측정 중' : `${formatTiming(shownMs)}초 측정 중`}>
            <i /><i /><i />
            <strong>{mode === 'blind' ? '••.••' : formatTiming(shownMs)}</strong>
            <span>{mode === 'blind' ? '감으로 세는 중' : 'SECONDS'}</span>
          </div>
          <button className="stop-button" onClick={stopAttempt}>
            <span>STOP</span>
            지금!
          </button>
          <small>최대 9.99초에 자동으로 멈춥니다.</small>
        </section>
      )}

      {phase === 'handoff' && (
        <section className="timing-center timing-handoff">
          <span className="lock-icon" aria-hidden="true">🔒</span>
          <p>참가자 {turn + 1} 기록 저장 완료</p>
          <h2>기록은 아직 비밀입니다</h2>
          <span>다음 사람이 볼 수 없도록 결과를 가렸어요.</span>
          <button className="timing-primary" onClick={nextPlayer}>참가자 {turn + 2}에게 전달했어요</button>
        </section>
      )}

      {phase === 'result' && buyer && (
        <section className="timing-result">
          <p className="timing-result-label">최종 결과 · 목표 {formatTiming(target)}초</p>
          <div className="buyer-card">
            <span aria-hidden="true">☕</span>
            <p>오늘 커피 살 사람</p>
            <h2>참가자 {buyer.player + 1}</h2>
            <small>목표에서 {formatTiming(buyer.error)}초 벗어남</small>
          </div>
          <ol className="timing-ranking">
            {ranked.map((result, index) => (
              <li key={result.player} className={result.player === buyer.player ? 'buyer' : ''}>
                <b>{index + 1}</b>
                <span>참가자 {result.player + 1}</span>
                <strong>{formatTiming(result.elapsed)}초</strong>
                <small>± {formatTiming(result.error)}초</small>
              </li>
            ))}
          </ol>
          <div className="timing-result-actions">
            <button className="timing-primary" onClick={replay}>같은 방식으로 한 판 더</button>
            <button className="timing-secondary" onClick={() => setPhase('setup')}>방식 바꾸기</button>
          </div>
        </section>
      )}
    </main>
  );
}
