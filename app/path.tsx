'use client';
import { ResultVerdict } from './result-verdict';

import { useCallback, useMemo, useRef, useState, useEffect, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import {
  PATH_BOARD_SIZE,
  PATH_HEAD_START_SECONDS,
  PATH_STEP_MS,
  PATH_TURN_SECONDS,
  makePathChallenges,
  pathProgress,
  pathScore,
  rankPathResults,
  tracePath,
  type PathChallenge,
  type PathFailure,
  type PathResult,
} from './path-game';

type Phase = 'setup' | 'ready' | 'play' | 'result' | 'final';

const ARROWS = ['↑', '→', '↓', '←'];
const DIRECTION_LABELS = ['위쪽', '오른쪽', '아래쪽', '왼쪽'];
const PLAYER_COLORS = ['#52e6c2', '#ff8b67', '#a990ff', '#f8ce57', '#ff79b0', '#66b8ff'];
const FAILURE_LABELS: Record<PathFailure, string> = {
  guard: '경비원에게 잡혔어요',
  wall: '건물 밖으로 잘못 나갔어요',
  loop: '같은 길을 빙글 돌았어요',
  timeout: '출구를 찾지 못했어요',
};

export default function PathGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [challenges, setChallenges] = useState(() => makePathChallenges(2, 9107));
  const [directions, setDirections] = useState([...challenges[0].directions]);
  const [thief, setThief] = useState(challenges[0].start);
  const [runner, setRunner] = useState(() => ({ row: Math.floor(challenges[0].start / PATH_BOARD_SIZE), column: challenges[0].start % PATH_BOARD_SIZE }));
  const [used, setUsed] = useState<number[]>([]);
  const [rotations, setRotations] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PATH_TURN_SECONDS);
  const [launchLeft, setLaunchLeft] = useState(PATH_HEAD_START_SECONDS);
  const [launched, setLaunched] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [results, setResults] = useState<PathResult[]>([]);
  const [lastResult, setLastResult] = useState<PathResult | null>(null);

  const directionsRef = useRef(directions);
  const thiefRef = useRef(thief);
  const usedRef = useRef(new Set<number>());
  const rotationsRef = useRef(0);
  const actualPathRef = useRef<number[]>([challenges[0].start]);
  const startedAtRef = useRef(0);
  const launchAtRef = useRef(0);
  const launchedRef = useRef(false);
  const stepRef = useRef(0);
  const lockedRef = useRef(false);
  const resolvingRef = useRef(false);

  const challenge = challenges[turn] ?? challenges[0];
  const ranked = useMemo(() => rankPathResults(results), [results]);
  const payer = ranked.at(-1);

  const prepare = useCallback((next: PathChallenge) => {
    const nextDirections = [...next.directions];
    directionsRef.current = nextDirections;
    thiefRef.current = next.start;
    usedRef.current = new Set();
    rotationsRef.current = 0;
    actualPathRef.current = [next.start];
    launchedRef.current = false;
    stepRef.current = 0;
    lockedRef.current = false;
    resolvingRef.current = false;
    setDirections(nextDirections);
    setThief(next.start);
    setRunner({ row: Math.floor(next.start / PATH_BOARD_SIZE), column: next.start % PATH_BOARD_SIZE });
    setUsed([]);
    setRotations(0);
    setTimeLeft(PATH_TURN_SECONDS);
    setLaunchLeft(PATH_HEAD_START_SECONDS);
    setLaunched(false);
    setResolving(false);
    setLastResult(null);
  }, []);

  const finishTurn = useCallback((success: boolean, elapsed: number, failure?: PathFailure) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const actual = actualPathRef.current;
    const result: PathResult = {
      player: turn,
      success,
      elapsed: Math.min(PATH_TURN_SECONDS, elapsed),
      rotations: rotationsRef.current,
      optimalRotations: challenge.optimalRotations,
      ...pathProgress(actual, challenge),
      failure,
    };
    setLastResult(result);
    setResults((current) => [...current, result]);
    setResolving(false);
    setPhase('result');
  }, [challenge, turn]);

  const advanceThief = useCallback((now: number) => {
    const current = thiefRef.current;
    const direction = directionsRef.current[current];
    usedRef.current.add(current);
    setUsed([...usedRef.current]);
    stepRef.current += 1;
    const elapsed = (now - startedAtRef.current) / 1000;
    const row = Math.floor(current / PATH_BOARD_SIZE);
    const column = current % PATH_BOARD_SIZE;
    const delta = [[-1, 0], [0, 1], [1, 0], [0, -1]][direction];

    const finishAfterMove = (success: boolean, failure?: PathFailure, targetRow = row + delta[0], targetColumn = column + delta[1]) => {
      resolvingRef.current = true;
      setResolving(true);
      setRunner({ row: targetRow, column: targetColumn });
      window.setTimeout(() => finishTurn(success, elapsed, failure), PATH_STEP_MS);
    };

    const nextRow = row + delta[0];
    const nextColumn = column + delta[1];
    if (nextRow < 0 || nextRow >= PATH_BOARD_SIZE || nextColumn < 0 || nextColumn >= PATH_BOARD_SIZE) {
      finishAfterMove(false, 'wall', nextRow, nextColumn);
      return;
    }
    const next = nextRow * PATH_BOARD_SIZE + nextColumn;
    if (challenge.hazards.includes(next)) {
      finishAfterMove(false, 'guard', nextRow, nextColumn);
      return;
    }
    if (next === challenge.exitCell) {
      thiefRef.current = next;
      actualPathRef.current = [...actualPathRef.current, next];
      setThief(next);
      finishAfterMove(true, undefined, nextRow, nextColumn);
      return;
    }
    if (actualPathRef.current.includes(next)) {
      finishAfterMove(false, 'loop', nextRow, nextColumn);
      return;
    }
    thiefRef.current = next;
    actualPathRef.current = [...actualPathRef.current, next];
    setThief(next);
    setRunner({ row: nextRow, column: nextColumn });
  }, [challenge, finishTurn]);

  useEffect(() => {
    if (phase !== 'play') return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - startedAtRef.current) / 1000;
      setTimeLeft(Math.max(0, PATH_TURN_SECONDS - elapsed));
      if (!launchedRef.current) setLaunchLeft(Math.max(0, (launchAtRef.current - now) / 1000));
      if (resolvingRef.current) return;
      if (elapsed >= PATH_TURN_SECONDS) {
        finishTurn(false, elapsed, 'timeout');
        return;
      }
      if (!launchedRef.current && now >= launchAtRef.current) {
        launchedRef.current = true;
        setLaunched(true);
      }
      if (launchedRef.current && now >= launchAtRef.current + stepRef.current * PATH_STEP_MS) advanceThief(now);
    }, 35);
    return () => window.clearInterval(timer);
  }, [advanceThief, finishTurn, phase]);

  function startGame() {
    const nextRound = round + 1;
    const nextChallenges = makePathChallenges(players, Date.now() + nextRound * 317);
    setRound(nextRound);
    setTurn(0);
    setChallenges(nextChallenges);
    setResults([]);
    prepare(nextChallenges[0]);
    setPhase('ready');
  }

  function beginTurn() {
    const now = performance.now();
    startedAtRef.current = now;
    launchAtRef.current = now + PATH_HEAD_START_SECONDS * 1000;
    setPhase('play');
  }

  function rotateTile(cell: number, now: number) {
    if (phase !== 'play' || lockedRef.current || usedRef.current.has(cell) || challenge.hazards.includes(cell)) return;
    const next = [...directionsRef.current];
    next[cell] = (next[cell] + 1) % 4 as 0 | 1 | 2 | 3;
    directionsRef.current = next;
    rotationsRef.current += 1;
    setDirections(next);
    setRotations(rotationsRef.current);
    if (!launchedRef.current && tracePath(challenge, next).success) {
      launchedRef.current = true;
      launchAtRef.current = now;
      setLaunched(true);
      setLaunchLeft(0);
    }
  }

  function nextPlayer() {
    if (turn + 1 >= players) {
      setPhase('final');
      return;
    }
    const nextTurn = turn + 1;
    setTurn(nextTurn);
    prepare(challenges[nextTurn]);
    setPhase('ready');
  }

  const boardCells = Array.from({ length: PATH_BOARD_SIZE ** 2 }, (_, index) => index);
  const currentDirection = directions[thief];
  const runnerStyle = { '--path-runner-row': runner.row, '--path-runner-column': runner.column } as CSSProperties;

  return (
    <main className="path-shell">
      <header className="path-topbar">
        <div><p>ROTATE · ESCAPE · OUTSMART</p><h1>길을 바꿔라</h1></div>
        <button onClick={onExit}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="path-setup">
          <div className="path-emblem" aria-hidden="true"><span>↱</span><i>🕵️</i><b>EXIT</b></div>
          <p className="path-kicker">5초 뒤, 도둑은 멈추지 않는다</p>
          <h2>화살표를 돌려<br />탈출로를 완성하세요</h2>
          <p>타일을 누르면 시계 방향으로 90° 회전합니다.<br />경비원을 피해 화살표 없는 EXIT 칸에 닿으면 성공입니다.</p>
          <p className="ranking-rule">탈출 성공이 우선 · 성공끼리는 점수 → 빠른 시간 → 적은 회전<br />실패끼리는 마지막 안전칸의 출구 접근률로 비교합니다.<br />경비원을 피해 남은 최단 거리를 출발 거리와 비교해요. 같은 기록은 공동 순위입니다.</p>
          <label className="path-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="path-primary" onClick={startGame}>탈출 작전 시작</button>
          <div className="path-rules"><span>↻ 회전마다 -5점</span><span>🚨 경비원 4명</span><span>⏱️ 1초마다 -2점</span></div>
        </section>
      )}

      {phase === 'ready' && (
        <section className="path-handoff">
          <div className="path-handoff-card" style={{ '--path-player': PLAYER_COLORS[turn] } as CSSProperties}>
            <span>🕵️</span><small>{turn + 1}/{players}번째 작전</small><h2>{PLAYER_NAMES[turn]} 준비</h2>
            <p>다른 사람이 길을 외우지 못하도록<br />화면을 가리고 기기를 넘겨주세요.</p>
            <button className="path-primary" onClick={beginTurn}>내 퍼즐 공개</button>
          </div>
        </section>
      )}

      {(phase === 'play' || phase === 'result') && (
        <section className="path-play" style={{ '--path-player': PLAYER_COLORS[turn] } as CSSProperties}>
          <div className="path-status">
            <i /><div><small>{PLAYER_NAMES[turn]} 차례 · {turn + 1}/{players}</small><strong>{phase === 'result' ? '작전 종료' : !launched ? `출발 준비 · ${launchLeft.toFixed(1)}초` : resolving ? '마지막 움직임 확인 중' : `이동 중 · 다음 ${DIRECTION_LABELS[currentDirection]}`}</strong></div>
            <b>{timeLeft.toFixed(1)}<small>초</small></b>
          </div>
          {phase === 'play' && !launched && (
            <div className="path-launch-banner" aria-label={`첫 출발 방향 ${DIRECTION_LABELS[currentDirection]}`}>
              <small>첫 출발 방향</small><strong>{ARROWS[currentDirection]}</strong><b>{DIRECTION_LABELS[currentDirection]}</b><span>{launchLeft.toFixed(1)}초 후 출발</span>
            </div>
          )}
          <div className="path-board-wrap">
            <div className="path-board" aria-label="5 곱하기 5 탈출 경로 게임판">
              {boardCells.map((cell) => {
                const isGuard = challenge.hazards.includes(cell);
                const isUsed = used.includes(cell);
                return isGuard ? (
                  <div className="path-cell path-guard" key={cell} aria-label="경비원"><span>🚨</span></div>
                ) : cell === challenge.exitCell ? (
                  <div className="path-cell path-exit" key={cell} role="img" aria-label="탈출구 EXIT"><span aria-hidden="true">🚪</span><strong>EXIT</strong><small>탈출구</small></div>
                ) : (
                  <button
                    key={cell}
                    className={`path-cell ${isUsed ? 'used' : ''} ${cell === thief ? 'current' : ''}`}
                    onClick={(event) => rotateTile(cell, event.timeStamp)}
                    disabled={phase !== 'play' || isUsed}
                    aria-label={`${ARROWS[directions[cell]]} 방향 타일`}
                  >
                    <span className="path-arrow">{ARROWS[directions[cell]]}</span>
                    {cell === challenge.start && <small className="path-start-label">출발</small>}
                  </button>
                );
              })}
              <span className={`path-thief-runner ${!launched ? 'prelaunch' : ''} ${resolving ? 'resolving' : ''}`} style={runnerStyle} aria-label={`도둑, 다음 이동 ${DIRECTION_LABELS[currentDirection]}`}>
                <i aria-hidden="true">🕵️</i><b aria-hidden="true">{ARROWS[currentDirection]}</b>
              </span>
            </div>
            {phase === 'result' && lastResult && (
              <div className={`path-turn-result ${lastResult.success ? 'success' : 'failed'}`}>
                <span>{lastResult.success ? '🏃‍➡️' : '🚨'}</span>
                <small>{lastResult.success ? '탈출 성공' : '작전 실패'}</small>
                <h2>{lastResult.success ? `${pathScore(lastResult)}점` : FAILURE_LABELS[lastResult.failure!]}</h2>
                <p>{lastResult.success
                  ? `기본 100점 · 시간 -${Math.round(lastResult.elapsed * 2)}점 · 회전 -${lastResult.rotations * 5}점`
                  : `출구 접근 ${lastResult.progress}% · 마지막 안전칸에서 출구까지 ${lastResult.remainingSteps}칸`}</p>
                <button className="path-primary" onClick={nextPlayer}>{turn + 1 >= players ? '최종 결과 보기' : '화면 가리고 넘기기'}</button>
              </div>
            )}
          </div>
          {phase === 'play' && (
            <div className="path-controls">
              <div className="path-timer"><i style={{ width: `${timeLeft / PATH_TURN_SECONDS * 100}%` }} /></div>
              <p>{launched ? '도둑 앞쪽 타일은 아직 돌릴 수 있어요' : '길이 완성되면 5초 전에도 바로 출발합니다'}</p>
              <b>{rotations}<small>회 · -{rotations * 5}점</small></b>
            </div>
          )}
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="path-final">
          <div className="path-payer"><span>☕</span><ResultVerdict results={ranked} /><strong>{payer.success ? `최종 점수 ${pathScore(payer)}점` : `출구 접근 ${payer.progress}%`}</strong></div>
          <ol>{ranked.map((result) => (
            <li key={result.player}><span>{result.rank}</span><i style={{ background: PLAYER_COLORS[result.player] }} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.success ? `${result.elapsed.toFixed(1)}초 · ${result.rotations}회 회전` : `${FAILURE_LABELS[result.failure!]} · 출구 접근 ${result.progress}%`}</small></div><b>{result.success ? `${pathScore(result)}점` : '실패'}</b></li>
          ))}</ol>
          <button className="path-primary" onClick={startGame}>새 경로로 한 판 더</button>
          <button className="path-secondary" onClick={onExit}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
