'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import { CUP_ROUNDS, cupRoundScore, finalCupSlot, makeCupChallenges, rankCupResults, type CupChallenge, type CupResult } from './cup-game';

type Phase = 'setup' | 'ready' | 'reveal' | 'shuffle' | 'choose' | 'roundResult' | 'final';
type CupVisual = { id: number; slot: number };

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const PLAYER_COLORS = ['#ef604d', '#2c9d91', '#7d69c7', '#e3a62f', '#e66e99', '#4b82ca'];

function initialCups(challenge: CupChallenge): CupVisual[] {
  return Array.from({ length: challenge.cupCount }, (_, id) => ({ id, slot: id }));
}

export default function CupGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [round, setRound] = useState(0);
  const [challenges, setChallenges] = useState(() => makeCupChallenges(2, 2401));
  const [cups, setCups] = useState<CupVisual[]>(() => initialCups(challenges[0][0]));
  const [activeIds, setActiveIds] = useState<number[]>([]);
  const [frontId, setFrontId] = useState<number | null>(null);
  const [liftedId, setLiftedId] = useState<number | null>(null);
  const [showBall, setShowBall] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [scores, setScores] = useState<CupResult[]>([]);
  const runRef = useRef(0);
  const choiceStartedRef = useRef(0);

  const challenge = challenges[player]?.[round] ?? challenges[0][0];
  const ranked = useMemo(() => rankCupResults(scores), [scores]);
  const payer = ranked.at(-1);
  const ballSlot = phase === 'reveal' ? challenge.targetCup : finalCupSlot(challenge);

  useEffect(() => () => { runRef.current += 1; }, []);

  function resetBoard(next: CupChallenge) {
    setCups(initialCups(next));
    setActiveIds([]);
    setFrontId(null);
    setLiftedId(null);
    setShowBall(false);
    setResolving(false);
    setSelectedId(null);
  }

  function startGame() {
    const next = makeCupChallenges(players, Date.now());
    runRef.current += 1;
    setChallenges(next);
    setPlayer(0);
    setRound(0);
    setScores(Array.from({ length: players }, (_, index) => ({ player: index, score: 0, correct: 0, decisionMs: 0 })));
    resetBoard(next[0][0]);
    setPhase('ready');
  }

  async function beginRound() {
    const token = ++runRef.current;
    const positions = initialCups(challenge);
    setCups(positions);
    setSelectedId(null);
    setLastScore(0);
    setPhase('reveal');
    setLiftedId(challenge.targetCup);
    setShowBall(true);
    await wait(1050);
    if (token !== runRef.current) return;
    setLiftedId(null);
    await wait(420);
    if (token !== runRef.current) return;
    setShowBall(false);
    setPhase('shuffle');
    await wait(180);

    for (let index = 0; index < challenge.swaps.length; index += 1) {
      if (token !== runRef.current) return;
      const [a, b] = challenge.swaps[index];
      const cupA = positions.find((cup) => cup.slot === a)!;
      const cupB = positions.find((cup) => cup.slot === b)!;
      setActiveIds([cupA.id, cupB.id]);
      setFrontId(index % 2 ? cupB.id : cupA.id);
      [cupA.slot, cupB.slot] = [cupB.slot, cupA.slot];
      setCups(positions.map((cup) => ({ ...cup })));
      await wait(challenge.speedMs);
      setActiveIds([]);
      setFrontId(null);
      await wait(65);
    }
    if (token !== runRef.current) return;
    choiceStartedRef.current = performance.now();
    setPhase('choose');
  }

  async function chooseCup(id: number, now: number) {
    if (phase !== 'choose' || resolving) return;
    const token = ++runRef.current;
    const decisionMs = now - choiceStartedRef.current;
    const correct = id === challenge.targetCup;
    setResolving(true);
    setSelectedId(id);
    setLiftedId(id);
    if (correct) {
      setShowBall(true);
      await wait(950);
    } else {
      await wait(650);
      if (token !== runRef.current) return;
      setLiftedId(null);
      await wait(200);
      if (token !== runRef.current) return;
      setLiftedId(challenge.targetCup);
      setShowBall(true);
      await wait(900);
    }
    if (token !== runRef.current) return;
    const earned = cupRoundScore(correct, decisionMs, round);
    setScores((current) => current.map((result) => result.player === player ? {
      ...result,
      score: result.score + earned,
      correct: result.correct + Number(correct),
      decisionMs: result.decisionMs + decisionMs,
    } : result));
    setLastCorrect(correct);
    setLastScore(earned);
    setResolving(false);
    setPhase('roundResult');
  }

  function continueGame() {
    if (round + 1 < CUP_ROUNDS) {
      const nextRound = round + 1;
      setRound(nextRound);
      resetBoard(challenges[player][nextRound]);
      setPhase('ready');
      return;
    }
    if (player + 1 < players) {
      const nextPlayer = player + 1;
      setPlayer(nextPlayer);
      setRound(0);
      resetBoard(challenges[nextPlayer][0]);
      setPhase('ready');
      return;
    }
    setPhase('final');
  }

  function exitGame() {
    runRef.current += 1;
    onExit();
  }

  const stageStyle = {
    '--cup-count': challenge.cupCount,
    '--cup-speed': `${challenge.speedMs}ms`,
    '--cup-player': PLAYER_COLORS[player],
  } as CSSProperties;

  return (
    <main className="cup-shell">
      <header className="cup-topbar">
        <div><p>WATCH · SHUFFLE · PICK</p><h1>컵 속 구슬</h1></div>
        <button onClick={exitGame}>게임 선택</button>
      </header>

      {phase === 'setup' && (
        <section className="cup-setup">
          <div className="cup-hero" aria-hidden="true">
            <img src="/cup-shuffle-cup.png" alt="" /><img src="/cup-shuffle-cup.png" alt="" /><img src="/cup-shuffle-cup.png" alt="" />
            <i />
          </div>
          <p className="cup-kicker">눈을 떼는 순간, 구슬은 사라진다</p>
          <h2>구슬을 숨긴 컵을<br />끝까지 따라가세요</h2>
          <p className="cup-intro">한 사람당 세 번, 점점 어렵게 섞습니다.<br />정답과 선택 속도를 합쳐 최종 순위를 정합니다.</p>
          <label className="cup-player-select">참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
          <button className="cup-primary" onClick={startGame}>첫 셔플 시작</button>
          <div className="cup-rules"><span>🥤 3컵 → 4컵 → 5컵</span><span>👀 3라운드</span><span>⚡ 속도 보너스</span></div>
        </section>
      )}

      {phase === 'ready' && (
        <section className="cup-ready">
          <div className="cup-ready-card" style={{ '--cup-player': PLAYER_COLORS[player] } as CSSProperties}>
            <img src="/cup-shuffle-cup.png" alt="" />
            <small>{player + 1}/{players}번째 참가자 · {round + 1}/{CUP_ROUNDS} 셔플</small>
            <h2>{PLAYER_NAMES[player]} 준비</h2>
            <p>{round === 0 ? '먼저 3개의 컵으로 눈을 풉니다.' : round === 1 ? '이번에는 4개의 컵이 더 빠르게 움직입니다.' : '마지막은 5개의 컵이 가장 빠르게 움직입니다.'}<br />다른 사람은 화면을 보지 마세요.</p>
            <button className="cup-primary" onClick={beginRound}>구슬 위치 보기</button>
          </div>
        </section>
      )}

      {(['reveal', 'shuffle', 'choose', 'roundResult'] as Phase[]).includes(phase) && (
        <section className="cup-play" style={{ '--cup-player': PLAYER_COLORS[player] } as CSSProperties}>
          <div className="cup-status">
            <i /><div><small>{PLAYER_NAMES[player]} · {round + 1}/{CUP_ROUNDS} 셔플</small><strong>{phase === 'reveal' ? '구슬 위치를 기억하세요' : phase === 'shuffle' ? '컵에서 눈을 떼지 마세요' : phase === 'choose' ? '구슬이 든 컵을 누르세요' : '구슬 공개!'}</strong></div>
            <b>{challenge.cupCount}<small> CUPS</small></b>
          </div>

          <div className={`cup-stage cups-${challenge.cupCount} phase-${phase}`} style={stageStyle} aria-label={`${challenge.cupCount}개 컵 셔플 게임판`}>
            <div className="cup-spotlight" />
            <span className={`cup-ball ${showBall ? 'visible' : ''}`} style={{ left: `${12 + ballSlot * (76 / (challenge.cupCount - 1))}%` }} aria-label={showBall ? '구슬' : undefined} />
            {cups.map((cup) => (
              <button
                key={cup.id}
                className={`cup-piece ${activeIds.includes(cup.id) ? 'swapping' : ''} ${frontId === cup.id ? 'front' : ''} ${liftedId === cup.id ? 'lifted' : ''} ${selectedId === cup.id ? 'selected' : ''}`}
                style={{ left: `${12 + cup.slot * (76 / (challenge.cupCount - 1))}%` }}
                disabled={phase !== 'choose' || resolving}
                onClick={(event) => chooseCup(cup.id, event.timeStamp)}
                aria-label={`${cup.slot + 1}번째 컵`}
              ><img src="/cup-shuffle-cup.png" alt="" draggable={false} /></button>
            ))}
            <div className="cup-table-edge" />
          </div>

          <div className="cup-caption">
            <span>{phase === 'shuffle' ? `${challenge.swaps.length}번 섞는 중` : phase === 'choose' ? '천천히 눌러도 되지만, 빠르면 보너스!' : phase === 'reveal' ? '빨간 구슬이 시작점입니다' : lastCorrect ? `정답 · +${lastScore}점` : '아쉽게 놓쳤습니다'}</span>
            <b>{scores[player]?.score ?? 0}<small>점</small></b>
          </div>

          {phase === 'roundResult' && (
            <div className={`cup-result ${lastCorrect ? 'correct' : 'wrong'}`}>
              <small>{lastCorrect ? '정확히 찾았습니다' : '구슬을 놓쳤습니다'}</small>
              <h2>{lastCorrect ? `+${lastScore}점` : '0점'}</h2>
              <p>{lastCorrect ? '정답 점수와 빠른 선택 보너스가 합산됐습니다.' : '다음 셔플에서 만회할 수 있습니다.'}</p>
              <button className="cup-primary" onClick={continueGame}>{round + 1 < CUP_ROUNDS ? '더 빠른 셔플 도전' : player + 1 < players ? '화면 가리고 넘기기' : '최종 결과 보기'}</button>
            </div>
          )}
        </section>
      )}

      {phase === 'final' && payer && (
        <section className="cup-final">
          <div className="cup-payer"><span>☕</span><p>오늘의 커피 담당</p><h2>{PLAYER_NAMES[payer.player]}</h2><strong>{payer.score}점 · {payer.correct}/{CUP_ROUNDS} 정답</strong></div>
          <ol>{ranked.map((result, index) => (
            <li key={result.player}><span>{index + 1}</span><i style={{ background: PLAYER_COLORS[result.player] }} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>{result.correct}/{CUP_ROUNDS} 정답 · 선택 {(result.decisionMs / 1000).toFixed(1)}초</small></div><b>{result.score}점</b></li>
          ))}</ol>
          <button className="cup-primary" onClick={startGame}>새 셔플로 한 판 더</button>
          <button className="cup-secondary" onClick={exitGame}>게임 선택으로</button>
        </section>
      )}
    </main>
  );
}
