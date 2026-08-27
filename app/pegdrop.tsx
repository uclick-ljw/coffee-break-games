'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PLAYER_NAMES } from './game';
import {
  BALL_RADIUS,
  BOARD_CONFIGS,
  canPlacePeg,
  DOME_CENTER_X,
  DOME_CENTER_Y,
  DOME_RADIUS_X,
  DOME_RADIUS_Y,
  FIELD_LEFT,
  FIELD_RIGHT,
  FIXED_PEGS,
  LAUNCHER,
  LANE_CENTER,
  makeHoles,
  makePlacementOrder,
  PEG_BOARD_HEIGHT,
  PEG_BOARD_WIDTH,
  PEG_RADIUS,
  SCORE_TOP,
  shuffledScores,
  stepBall,
  type BallState,
  type Hole,
  type Peg,
} from './peg-game';

const PLAYER_COLORS = ['#168ad5', '#ff8f45', '#8b6edb', '#28a77a', '#e84d9b', '#e6b81e'];
type Phase = 'place' | 'shoot' | 'result';
type Point = { x: number; y: number };

function drawBoard(
  canvas: HTMLCanvasElement,
  holes: Hole[],
  pegs: Peg[],
  scores: number[],
  phase: Phase,
  ball: BallState | null,
  aim: Point | null,
) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== PEG_BOARD_WIDTH * ratio || canvas.height !== PEG_BOARD_HEIGHT * ratio) {
    canvas.width = PEG_BOARD_WIDTH * ratio;
    canvas.height = PEG_BOARD_HEIGHT * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, PEG_BOARD_WIDTH, PEG_BOARD_HEIGHT);

  const background = context.createLinearGradient(0, 0, 0, PEG_BOARD_HEIGHT);
  background.addColorStop(0, '#173b57');
  background.addColorStop(0.78, '#102b42');
  background.addColorStop(1, '#0b2033');
  context.fillStyle = background;
  context.beginPath();
  context.roundRect(5, 5, PEG_BOARD_WIDTH - 10, PEG_BOARD_HEIGHT - 10, 24);
  context.fill();

  context.strokeStyle = '#234b65';
  context.lineCap = 'round';
  context.lineWidth = 30;
  context.beginPath();
  context.moveTo(LANE_CENTER, PEG_BOARD_HEIGHT - 22);
  context.lineTo(LANE_CENTER, DOME_CENTER_Y);
  context.stroke();
  context.strokeStyle = '#9edfeb55';
  context.lineWidth = 3;
  context.stroke();

  context.strokeStyle = '#234b65';
  context.lineWidth = 12;
  context.beginPath();
  context.ellipse(DOME_CENTER_X, DOME_CENTER_Y, DOME_RADIUS_X, DOME_RADIUS_Y, 0, Math.PI, Math.PI * 2);
  context.stroke();
  context.strokeStyle = '#9edfeb77';
  context.lineWidth = 3;
  context.stroke();

  context.strokeStyle = '#8bdcf055';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(FIELD_LEFT, DOME_CENTER_Y);
  context.lineTo(FIELD_LEFT, PEG_BOARD_HEIGHT - 18);
  context.moveTo(FIELD_RIGHT, DOME_CENTER_Y);
  context.lineTo(FIELD_RIGHT, PEG_BOARD_HEIGHT - 18);
  context.moveTo(PEG_BOARD_WIDTH - 16, DOME_CENTER_Y);
  context.lineTo(PEG_BOARD_WIDTH - 16, PEG_BOARD_HEIGHT - 18);
  context.stroke();
  context.lineCap = 'butt';

  context.fillStyle = '#dff8ffcc';
  context.font = '800 10px Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText(phase === 'place' ? '돌기 배치 구역' : '오른쪽 플런저를 아래로 당기세요', (FIELD_LEFT + FIELD_RIGHT) / 2, 25);

  if (phase === 'place') {
    for (const hole of holes) {
      context.fillStyle = pegs.some((peg) => peg.id === hole.id) ? '#071c2b55' : '#b9eafa40';
      context.beginPath();
      context.arc(hole.x, hole.y, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#c6f4ff55';
      context.lineWidth = 1;
      context.stroke();
    }
  }

  for (const peg of [...FIXED_PEGS, ...pegs]) {
    context.shadowColor = '#0008';
    context.shadowBlur = 7;
    context.shadowOffsetY = 3;
    const shine = context.createRadialGradient(peg.x - 2, peg.y - 3, 1, peg.x, peg.y, PEG_RADIUS + 2);
    shine.addColorStop(0, '#fff');
    shine.addColorStop(0.25, peg.owner < 0 ? '#a8ecf5' : PLAYER_COLORS[peg.owner]);
    shine.addColorStop(1, '#071c2b');
    context.fillStyle = shine;
    context.beginPath();
    context.arc(peg.x, peg.y, PEG_RADIUS + 1, 0, Math.PI * 2);
    context.fill();
  }
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  const binWidth = (FIELD_RIGHT - FIELD_LEFT) / scores.length;
  for (let index = 0; index < scores.length; index += 1) {
    const x = FIELD_LEFT + index * binWidth;
    context.fillStyle = scores[index] === 100 ? '#ffcf5c33' : index % 2 ? '#ffffff10' : '#73d0be14';
    context.fillRect(x, SCORE_TOP, binWidth, PEG_BOARD_HEIGHT - 18 - SCORE_TOP);
    if (index) {
      context.strokeStyle = '#a7deea88';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, SCORE_TOP);
      context.lineTo(x, PEG_BOARD_HEIGHT - 18);
      context.stroke();
    }
    context.fillStyle = scores[index] === 100 ? '#ffd971' : '#dff8ff';
    context.font = scores[index] === 100 ? '900 13px Arial, sans-serif' : '800 11px Arial, sans-serif';
    context.fillText(String(scores[index]), x + binWidth / 2, PEG_BOARD_HEIGHT - 28);
  }
  context.strokeStyle = '#a7deea88';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(FIELD_LEFT, SCORE_TOP);
  context.lineTo(FIELD_RIGHT, SCORE_TOP);
  context.stroke();

  if (phase !== 'place') {
    if (aim) {
      context.strokeStyle = '#ffd971';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(LAUNCHER.x, LAUNCHER.y);
      context.lineTo(aim.x, aim.y);
      context.stroke();
      context.fillStyle = '#ffd971';
      context.beginPath();
      context.arc(aim.x, aim.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd97188';
      context.fillRect(FIELD_RIGHT + 7, LAUNCHER.y - (aim.y - LAUNCHER.y) * 2.5, 5, (aim.y - LAUNCHER.y) * 2.5);
    }
    const shownBall = ball ?? LAUNCHER;
    context.shadowColor = '#0009';
    context.shadowBlur = 8;
    context.shadowOffsetY = 4;
    const ballShine = context.createRadialGradient(shownBall.x - 3, shownBall.y - 4, 1, shownBall.x, shownBall.y, BALL_RADIUS);
    ballShine.addColorStop(0, '#fff');
    ballShine.addColorStop(0.25, '#ffdf72');
    ballShine.addColorStop(1, '#e96d32');
    context.fillStyle = ballShine;
    context.beginPath();
    context.arc(shownBall.x, shownBall.y, BALL_RADIUS + 2, 0, Math.PI * 2);
    context.fill();
  }
}

export default function PegDropGame({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState(2);
  const [phase, setPhase] = useState<Phase>('place');
  const [pegs, setPegs] = useState<Peg[]>([]);
  const [placementIndex, setPlacementIndex] = useState(0);
  const [shotIndex, setShotIndex] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [scoreLayout, setScoreLayout] = useState(() => shuffledScores(20260824));
  const [ball, setBall] = useState<BallState | null>(null);
  const [aim, setAim] = useState<Point | null>(null);
  const [flying, setFlying] = useState(false);
  const [misfire, setMisfire] = useState(false);
  const [lastScore, setLastScore] = useState<{ player: number; points: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);
  const frameRef = useRef(0);
  const timerRef = useRef(0);
  const generationRef = useRef(0);
  const seedRef = useRef(20260824);
  const holes = useMemo(() => makeHoles(players), [players]);
  const placementOrder = useMemo(() => makePlacementOrder(players), [players]);
  const physicsPegs = useMemo(() => [...FIXED_PEGS, ...pegs], [pegs]);
  const shotOrder = useMemo(() => [
    ...Array.from({ length: players }, (_, index) => index),
    ...Array.from({ length: players }, (_, index) => players - 1 - index),
  ], [players]);
  const currentPlayer = phase === 'place' ? placementOrder[placementIndex] : shotOrder[Math.min(shotIndex, shotOrder.length - 1)];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawBoard(canvas, holes, pegs, scoreLayout, phase, ball, aim);
  }, [aim, ball, holes, pegs, phase, scoreLayout]);

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timerRef.current);
  }, []);

  function restart(nextPlayers = players) {
    generationRef.current += 1;
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timerRef.current);
    seedRef.current += 97 + nextPlayers;
    setPlayers(nextPlayers);
    setPhase('place');
    setPegs([]);
    setPlacementIndex(0);
    setShotIndex(0);
    setScores(Array(nextPlayers).fill(0));
    setScoreLayout(shuffledScores(seedRef.current));
    setBall(null);
    setAim(null);
    setFlying(false);
    setMisfire(false);
    setLastScore(null);
    draggingRef.current = false;
  }

  function placePeg(hole: Hole) {
    if (phase !== 'place' || !canPlacePeg(pegs, hole)) return;
    const next = [...pegs, { ...hole, owner: currentPlayer }];
    setPegs(next);
    if (next.length === placementOrder.length) {
      setPlacementIndex(placementOrder.length);
      setPhase('shoot');
    } else {
      setPlacementIndex((index) => index + 1);
    }
  }

  function boardPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * PEG_BOARD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * PEG_BOARD_HEIGHT,
    };
  }

  function clampAim(point: Point) {
    return { x: LAUNCHER.x, y: LAUNCHER.y + Math.max(8, Math.min(100, point.y - LAUNCHER.y)) };
  }

  function startAim(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (phase !== 'shoot' || flying || lastScore || misfire) return;
    const point = boardPoint(event);
    if (Math.hypot(point.x - LAUNCHER.x, point.y - LAUNCHER.y) > 34) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setAim(clampAim(point));
  }

  function moveAim(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    setAim(clampAim(boardPoint(event)));
  }

  function finishShot(slot: number, generation: number) {
    const points = scoreLayout[slot];
    const shooter = shotOrder[shotIndex];
    setScores((current) => current.map((score, index) => index === shooter ? score + points : score));
    setLastScore({ player: shooter, points });
    setFlying(false);
    timerRef.current = window.setTimeout(() => {
      if (generationRef.current !== generation) return;
      setBall(null);
      setLastScore(null);
      const nextShot = shotIndex + 1;
      if (nextShot >= shotOrder.length) {
        setPhase('result');
        return;
      }
      if (nextShot === players) setScoreLayout(shuffledScores(seedRef.current + 503));
      setShotIndex(nextShot);
    }, 650);
  }

  function launch(releaseAim: Point) {
    const pull = releaseAim.y - LAUNCHER.y;
    if (pull < 16) return;
    const generation = generationRef.current;
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const strength = Math.max(0, Math.min(1, (pull - 24) / 76));
    let physics: BallState = {
      ...LAUNCHER,
      vx: 0,
      vy: -(460 + pull * 4.5),
      age: 0,
      stage: 'lane',
      guide: 0,
      curveEnd: Math.PI * (0.28 + strength * 0.61),
      bias: (random % 25) - 12,
    };
    let previous = performance.now();
    let accumulator = 0;
    setBall(physics);
    setFlying(true);
    const animate = (now: number) => {
      if (generationRef.current !== generation) return;
      accumulator += Math.min(0.04, (now - previous) / 1000);
      previous = now;
      let result = { ball: physics, settled: false, misfire: false, slot: -1 };
      while (accumulator >= 1 / 120) {
        result = stepBall(physics, physicsPegs, 1 / 120);
        physics = result.ball;
        accumulator -= 1 / 120;
        if (result.settled || result.misfire) break;
      }
      setBall({ ...physics });
      if (result.settled) finishShot(result.slot, generation);
      else if (result.misfire) {
        setFlying(false);
        setBall(null);
        setMisfire(true);
        timerRef.current = window.setTimeout(() => {
          if (generationRef.current === generation) setMisfire(false);
        }, 700);
      }
      else frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
  }

  function releaseAim(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const release = aim;
    setAim(null);
    if (release) launch(release);
  }

  const config = BOARD_CONFIGS[players];
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const winners = scores.flatMap((score, index) => score === maxScore ? [PLAYER_NAMES[index]] : []);
  const coffee = scores.flatMap((score, index) => score === minScore ? [PLAYER_NAMES[index]] : []);
  const status = phase === 'place'
    ? `${PLAYER_NAMES[currentPlayer]}이 돌기를 놓으세요`
    : phase === 'result'
      ? `${winners.join('·')} 승리`
      : lastScore
        ? `${PLAYER_NAMES[lastScore.player]} +${lastScore.points}점`
        : misfire
          ? '힘이 부족합니다. 다시 당기세요'
        : flying
          ? '구슬이 상단 레일을 따라 이동합니다'
          : `${PLAYER_NAMES[currentPlayer]}이 플런저를 당기세요`;

  return (
    <main className="game-shell peg-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BUILD &amp; BOUNCE</p>
          <h1>툭 떨어뜨려</h1>
        </div>
        <div className="game-actions">
          <button className="restart-small" disabled={flying} onClick={onExit}>게임 선택</button>
          <label className="player-select">
            <span>인원</span>
            <select value={players} disabled={flying} onChange={(event) => restart(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}
            </select>
          </label>
          <button className="restart-small" disabled={flying} onClick={() => restart()}>새 게임</button>
        </div>
      </header>

      <section className="status-card peg-status" aria-live="polite">
        <div className={`player-dot player-${currentPlayer}`} />
        <div>
          <span>{phase === 'place' ? `돌기 ${pegs.length}/${config.pegs}` : `발사 ${Math.min(shotIndex + 1, shotOrder.length)}/${shotOrder.length}`}</span>
          <strong>{status}</strong>
        </div>
        <div className="move-count"><span>{phase === 'place' ? '남음' : '라운드'}</span><b>{phase === 'place' ? config.pegs - pegs.length : Math.min(2, Math.floor(shotIndex / players) + 1)}</b></div>
      </section>

      <section className="score-grid peg-scores" aria-label="플레이어별 점수">
        {scores.map((score, index) => (
          <div key={index} className={`score-chip player-border-${index} ${currentPlayer === index && phase !== 'result' ? 'current' : ''}`}>
            <span>{PLAYER_NAMES[index]}</span><b>{score}</b>
          </div>
        ))}
      </section>

      <section className="peg-board-wrap" aria-label={`${players}인용 돌기 낙하 게임판`}>
        <div className="peg-board">
          <canvas
            ref={canvasRef}
            width={PEG_BOARD_WIDTH}
            height={PEG_BOARD_HEIGHT}
            onPointerDown={startAim}
            onPointerMove={moveAim}
            onPointerUp={releaseAim}
            onPointerCancel={releaseAim}
            role="img"
            aria-label={phase === 'place' ? '돌기를 배치할 게임판' : '오른쪽 구슬을 아래로 당겨 발사하는 핀볼 게임판'}
          />
          {phase === 'place' && holes.map((hole) => (
            <button
              key={hole.id}
              className="peg-hole"
              style={{ left: `${(hole.x / PEG_BOARD_WIDTH) * 100}%`, top: `${(hole.y / PEG_BOARD_HEIGHT) * 100}%` }}
              disabled={!canPlacePeg(pegs, hole)}
              onClick={() => placePeg(hole)}
              aria-label={`${hole.row + 1}행 ${hole.col + 1}열에 돌기 놓기`}
            />
          ))}
        </div>
        <p className="rule">{phase === 'place' ? '은색 고정 범퍼 아래에 모두 5개씩 놓습니다.' : '길게 당길수록 둥근 상단 레일을 더 멀리 돌아 위에서 떨어집니다.'}</p>
      </section>

      {phase === 'result' && (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-labelledby="peg-result-title">
          <div className="result-card peg-result">
            <span className="result-penguin">🏆</span>
            <p>두 번씩 발사 완료</p>
            <h2 id="peg-result-title">{winners.join('·')} 승리</h2>
            <span>{scores.map((score, index) => `${PLAYER_NAMES[index]} ${score}점`).join(' · ')}</span>
            <strong>커피는 {coffee.join('·')}!</strong>
            <button autoFocus onClick={() => restart()}>한 판 더</button>
          </div>
        </div>
      )}
    </main>
  );
}
