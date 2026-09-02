'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import { DARTS_PER_ROUND, DART_FLIGHT_MS, DART_ROUNDS, DART_ROUND_INFO, DART_SHOT_MS, DART_STARTING_ANGLES, advanceDartAngle, canPlaceDart, dartImpactAngle, dartMotionSpeed, rankDartResults, type DartResult } from './dart-game';

type Phase = 'setup' | 'handoff' | 'play' | 'roundResult' | 'final';
type ShotState = 'idle' | 'flying' | 'hit' | 'miss';

const COLORS = ['#4ceaff', '#ff638d', '#a580ff', '#ffd15c', '#62e59b', '#ff9c54'];
const clock = () => performance.now();

export default function DartGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [round, setRound] = useState(0);
  const [player, setPlayer] = useState(0);
  const [angle, setAngle] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [shots, setShots] = useState(0);
  const [hits, setHits] = useState(0);
  const [shot, setShot] = useState<ShotState>('idle');
  const [outcomes, setOutcomes] = useState<Array<'hit' | 'miss'>>([]);
  const [shotSerial, setShotSerial] = useState(0);
  const [autoShot, setAutoShot] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DART_SHOT_MS);
  const [attempt, setAttempt] = useState<DartResult | null>(null);
  const [results, setResults] = useState<DartResult[]>([]);
  const angleRef = useRef(0);
  const placedRef = useRef<number[]>([]);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const shotsRef = useRef(0);
  const motionStartedRef = useRef(0);
  const attemptStartedRef = useRef(0);
  const lastFrameRef = useRef(0);
  const deadlineRef = useRef(0);
  const resolvingRef = useRef(false);
  const fireRef = useRef<(automatic?: boolean) => void>(() => undefined);
  const timersRef = useRef<number[]>([]);

  const ranked = useMemo(() => rankDartResults(results, players), [players, results]);
  const payer = ranked.at(-1);
  const style = { '--dart-player': COLORS[player] } as CSSProperties;
  const info = DART_ROUND_INFO[round];

  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (phase !== 'play') return;
    let frame = 0;
    lastFrameRef.current = clock();
    const tick = (now: number) => {
      const seconds = Math.min(.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      const nextSpeed = dartMotionSpeed(round, (now - motionStartedRef.current) / 1000);
      angleRef.current = advanceDartAngle(angleRef.current, nextSpeed, seconds);
      setAngle(angleRef.current);
      setSpeed(nextSpeed);
      setTimeLeft(Math.max(0, deadlineRef.current - now));
      if (now >= deadlineRef.current && !resolvingRef.current) fireRef.current(true);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, round]);

  function later(action: () => void, milliseconds: number) {
    const timer = window.setTimeout(action, milliseconds);
    timersRef.current.push(timer);
  }

  function resetAttempt(targetRound = round) {
    const startingAngles = [...DART_STARTING_ANGLES[targetRound]];
    angleRef.current = 0;
    placedRef.current = startingAngles;
    hitsRef.current = 0;
    missesRef.current = 0;
    shotsRef.current = 0;
    resolvingRef.current = false;
    setAngle(0);
    setSpeed(0);
    setPlaced(startingAngles);
    setShots(0);
    setHits(0);
    setShot('idle');
    setOutcomes([]);
    setAutoShot(false);
    setAttempt(null);
    setTimeLeft(DART_SHOT_MS);
  }

  function startGame() {
    setRound(0);
    setPlayer(0);
    setResults([]);
    resetAttempt(0);
    setPhase('handoff');
  }

  function startAttempt() {
    resetAttempt();
    const now = clock();
    motionStartedRef.current = now;
    attemptStartedRef.current = now;
    deadlineRef.current = now + DART_SHOT_MS;
    setPhase('play');
  }

  function finishAttempt() {
    const result = { player, round, hits: hitsRef.current, misses: missesRef.current, duration: Math.round(clock() - attemptStartedRef.current) };
    setAttempt(result);
    setResults((current) => [...current, result]);
    setPhase('roundResult');
  }

  function fireDart(automatic = false) {
    if (phase !== 'play' || resolvingRef.current || shotsRef.current >= DARTS_PER_ROUND) return;
    resolvingRef.current = true;
    setAutoShot(automatic);
    setShot('flying');
    setShotSerial((value) => value + 1);
    later(() => {
      const now = clock();
      const seconds = Math.min(.05, (now - lastFrameRef.current) / 1000);
      const currentSpeed = dartMotionSpeed(round, (now - motionStartedRef.current) / 1000);
      angleRef.current = advanceDartAngle(angleRef.current, currentSpeed, seconds);
      lastFrameRef.current = now;
      setAngle(angleRef.current);
      setSpeed(currentSpeed);
      const impact = dartImpactAngle(angleRef.current);
      const success = canPlaceDart(placedRef.current, impact);
      if (success) {
        placedRef.current = [...placedRef.current, impact];
        hitsRef.current += 1;
        setPlaced(placedRef.current);
        setHits(hitsRef.current);
      } else {
        missesRef.current += 1;
      }
      shotsRef.current += 1;
      setShots(shotsRef.current);
      setOutcomes((current) => [...current, success ? 'hit' : 'miss']);
      setShot(success ? 'hit' : 'miss');
      later(() => {
        if (shotsRef.current >= DARTS_PER_ROUND) {
          finishAttempt();
          return;
        }
        resolvingRef.current = false;
        setShot('idle');
        setAutoShot(false);
        setTimeLeft(DART_SHOT_MS);
        deadlineRef.current = clock() + DART_SHOT_MS;
      }, 340);
    }, DART_FLIGHT_MS);
  }
  useEffect(() => {
    fireRef.current = fireDart;
  });

  function nextAttempt() {
    let targetRound = round;
    if (player + 1 < players) setPlayer((value) => value + 1);
    else if (round + 1 < DART_ROUNDS) {
      targetRound = round + 1;
      setRound((value) => value + 1);
      setPlayer(0);
    } else {
      setPhase('final');
      return;
    }
    resetAttempt(targetRound);
    setPhase('handoff');
  }

  const finalAttempt = round + 1 === DART_ROUNDS && player + 1 === players;

  return <main className="dart-shell" style={style}>
    <header className="dart-topbar"><div><p>TAP · STICK · SURVIVE</p><h1>빙글 꽂아라</h1></div><button onClick={onExit}>게임 선택</button></header>

    {phase === 'setup' && <section className="dart-setup">
      <div className="dart-hero" aria-hidden="true"><div>{DART_STARTING_ANGLES[0].map((value) => <i key={value} style={{ '--dart-angle': `${value}deg` } as CSSProperties} />)}<span>3</span></div><b>➤</b></div>
      <p className="dart-kicker">빈틈을 읽고 한 발씩</p><h2>돌아가는 판에<br />다트를 꽂아라</h2>
      <p>미리 꽂힌 다트 사이를 노려 화면을 누르세요.<br />다트끼리 충돌하면 튕겨 나갑니다.</p>
      <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
      <button className="dart-primary" onClick={startGame}>회전판 시작</button>
      <div className="dart-rules"><span>🎯 라운드당 3발</span><span>⏱️ 발당 2.6초</span><span>🌀 장애물 3→5→7</span></div>
    </section>}

    {phase === 'handoff' && <section className="dart-handoff"><div>
      <span className="dart-round-icon">{round === 0 ? '↻' : round === 1 ? '⇄' : '⚡'}</span><small>{round + 1}/3 라운드 · {player + 1}/{players}번째</small>
      <h2>{PLAYER_NAMES[player]} 준비</h2><strong>{info.name}</strong><p>{info.hint}.<br />모든 참가자에게 같은 움직임이 적용됩니다.</p>
      <button className="dart-primary" onClick={startAttempt}>다트 3개 받기</button>
    </div></section>}

    {phase === 'play' && <section className="dart-play">
      <div className="dart-status"><i /><div><small>{PLAYER_NAMES[player]} · {round + 1}/3 라운드</small><strong>{shot === 'miss' ? '충돌! 다트가 튕겼습니다' : shot === 'hit' ? '정확히 꽂혔습니다!' : autoShot ? '시간 초과 · 자동 발사!' : '빈틈이 오면 화면을 누르세요'}</strong></div><b>{hits}<small>점</small></b></div>
      <div className="dart-timer"><i style={{ width: `${timeLeft / DART_SHOT_MS * 100}%` }} /></div>
      <button className={`dart-arena shot-${shot}`} onClick={() => fireDart(false)} aria-label="다트 발사" aria-disabled={shot !== 'idle'}>
        <div className="dart-speed"><span>{speed >= 0 ? '↻' : '↺'}</span><strong>{Math.round(Math.abs(speed))}</strong><small>°/s</small></div>
        <div className="dart-rotor" style={{ transform: `rotate(${angle}deg)` }}>
          <div className="dart-disc"><i /><i /><i /><strong>{DARTS_PER_ROUND - shots}</strong><small>남은 다트</small></div>
          {placed.map((dartAngle, index) => <span className={`dart-stuck ${index < DART_STARTING_ANGLES[round].length ? 'neutral' : ''}`} key={`${index}-${dartAngle}`} style={{ '--dart-angle': `${dartAngle}deg`, '--dart-color': index < DART_STARTING_ANGLES[round].length ? '#ffd45f' : COLORS[player] } as CSSProperties}><i /><b /></span>)}
        </div>
        <span key={shotSerial} className={`dart-projectile ${shot}`}><i /><b /></span>
        <div className="dart-launcher"><i /><span>TAP</span></div>
        <p>{shot === 'idle' ? '화면 어디든 눌러 발사' : shot === 'flying' ? '다트 비행 중…' : shot === 'hit' ? 'STICK!' : 'CLASH!'}</p>
      </button>
      <div className="dart-ammo">{Array.from({ length: DARTS_PER_ROUND }, (_, index) => <i key={index} className={outcomes[index] ?? ''} />)}</div>
    </section>}

    {phase === 'roundResult' && attempt && <section className="dart-round-result">
      <div className="dart-result-disc"><span>{attempt.hits}</span><small>/ {DARTS_PER_ROUND}</small></div><p>{info.name} 결과</p><h2>{attempt.hits}개 꽂기 성공</h2><strong>충돌 {attempt.misses}회 · {(attempt.duration / 1000).toFixed(1)}초</strong>
      <button className="dart-primary" onClick={nextAttempt}>{finalAttempt ? '최종 순위 보기' : player + 1 < players ? '화면 가리고 넘기기' : '다음 회전으로'}</button>
    </section>}

    {phase === 'final' && payer && <section className="dart-final">
      <div className="dart-payer"><span>☕</span><p>가장 적게 꽂은 사람</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>총 {payer.hits}/{DARTS_PER_ROUND * DART_ROUNDS}개 성공</strong></div>
      <ol>{ranked.map((entry, index) => <li key={entry.player}><b>{index + 1}</b><i style={{ background: COLORS[entry.player] }} /><div><strong>{PLAYER_NAMES[entry.player]}</strong><small>충돌 {entry.misses}회 · {(entry.duration / 1000).toFixed(1)}초</small></div><span>{entry.hits}<small>/{DARTS_PER_ROUND * DART_ROUNDS}</small></span></li>)}</ol>
      <button className="dart-primary" onClick={startGame}>새 회전판으로 한 판 더</button><button className="dart-secondary" onClick={onExit}>게임 선택으로</button>
    </section>}
  </main>;
}
