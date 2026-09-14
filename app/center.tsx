'use client';
import { ResultVerdict } from './result-verdict';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { PLAYER_NAMES } from './game';
import { buildCenterFaces, CENTER_ROUNDS, isCenterHit, makeCenterChallenges, projectMassCenter, rankCenterPlayers, scoreCenterGuess, type CenterAngles, type CenterChallenge, type CenterOutcome, type CenterFace } from './center-game';

type Phase = 'setup' | 'ready' | 'play' | 'final';

const COLORS = ['#25b9d4', '#ff9761', '#9d7dea', '#5bc88b', '#f05d98', '#e8c34a'];
const CANVAS_SIZE = 390;
const YAW_STEP = .6;
const PITCH_STEP = .4;

function facePath(context: CanvasRenderingContext2D, face: CenterFace) {
  context.beginPath();
  context.moveTo(face.points[0].x * CANVAS_SIZE, face.points[0].y * CANVAS_SIZE);
  for (const point of face.points.slice(1)) context.lineTo(point.x * CANVAS_SIZE, point.y * CANVAS_SIZE);
  context.closePath();
}

function shade(hex: string, light: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const scale = .7 + light * .4;
  const channel = (shift: number) => Math.min(255, Math.round((value >> shift & 255) * scale));
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

function marker(context: CanvasRenderingContext2D, point: { x: number; y: number }, color: string, filled = false) {
  const x = point.x * CANVAS_SIZE;
  const y = point.y * CANVAS_SIZE;
  context.beginPath();
  context.arc(x, y, 8, 0, Math.PI * 2);
  context.fillStyle = filled ? color : '#ffffff88';
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.stroke();
  context.beginPath();
  context.moveTo(x - 12, y); context.lineTo(x + 12, y);
  context.moveTo(x, y - 12); context.lineTo(x, y + 12);
  context.lineWidth = 2;
  context.stroke();
}

function paintCenterModel(canvas: HTMLCanvasElement, challenge: CenterChallenge, angles: CenterAngles, outcome?: CenterOutcome, reveal = false, inspect = false) {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== CANVAS_SIZE * ratio || canvas.height !== CANVAS_SIZE * ratio) {
    canvas.width = CANVAS_SIZE * ratio;
    canvas.height = CANVAS_SIZE * ratio;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  context.save();
  context.beginPath();
  context.ellipse(CANVAS_SIZE / 2, CANVAS_SIZE * .77, 108, 24, 0, 0, Math.PI * 2);
  context.fillStyle = '#2b214b24';
  context.filter = 'blur(8px)';
  context.fill();
  context.restore();

  context.lineJoin = 'round';
  for (const face of buildCenterFaces(challenge, angles.yaw, angles.pitch)) {
    facePath(context, face);
    const fill = shade(challenge.color, face.light);
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = fill;
    context.lineWidth = .8;
    context.stroke();
  }

  if (reveal && outcome) {
    context.beginPath();
    context.moveTo(outcome.guess.x * CANVAS_SIZE, outcome.guess.y * CANVAS_SIZE);
    context.lineTo(challenge.center.x * CANVAS_SIZE, challenge.center.y * CANVAS_SIZE);
    context.strokeStyle = '#ffffff';
    context.setLineDash([5, 5]);
    context.lineWidth = 2;
    context.stroke();
    context.setLineDash([]);
  }
  if (outcome) marker(context, outcome.guess, '#e63f63');
  if (reveal) marker(context, challenge.center, '#23bc7d', true);

  if (inspect) {
    const baseX = 45;
    const baseY = 343;
    context.font = '800 9px Arial';
    for (const [label, dx, dy, color] of [['X', 27, 0, '#ef5f78'], ['Y', 0, -27, '#37b984'], ['Z', -17, 14, '#6e8ce8']] as const) {
      context.beginPath(); context.moveTo(baseX, baseY); context.lineTo(baseX + dx, baseY + dy); context.strokeStyle = color; context.lineWidth = 2; context.stroke();
      context.fillStyle = color; context.fillText(label, baseX + dx + 4, baseY + dy + 3);
    }
  }
}

function CenterCanvas({ challenge, angles, outcome, reveal = false, inspect = false, onClick }: { challenge: CenterChallenge; angles: CenterAngles; outcome?: CenterOutcome; reveal?: boolean; inspect?: boolean; onClick?: (event: ReactMouseEvent<HTMLCanvasElement>) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paintCenterModel(ref.current, challenge, angles, outcome, reveal, inspect); }, [angles, challenge, inspect, outcome, reveal]);
  return <canvas ref={ref} className="center-model" aria-label={`${challenge.name} 3D 물체 · 누르면 무게중심 선택`} onClick={onClick} onContextMenu={(event) => event.preventDefault()} />;
}

export default function CenterGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [round, setRound] = useState(0);
  const [challenges, setChallenges] = useState<CenterChallenge[][]>([]);
  const [outcomes, setOutcomes] = useState<CenterOutcome[]>([]);
  const [sealed, setSealed] = useState<CenterOutcome | null>(null);
  const [angles, setAngles] = useState<CenterAngles>({ yaw: 0, pitch: 0 });
  const [rotating, setRotating] = useState(false);
  const [message, setMessage] = useState('물체를 누르면 즉시 무게중심이 선택됩니다.');
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
  }, []);

  const ranked = useMemo(() => rankCenterPlayers(outcomes, players), [outcomes, players]);
  const payer = ranked.at(-1);
  const current = challenges[player]?.[round];

  function startGame() {
    const nextChallenges = makeCenterChallenges(players, Date.now());
    setChallenges(nextChallenges);
    setOutcomes([]);
    setPlayer(0);
    setRound(0);
    setSealed(null);
    setAngles({ yaw: nextChallenges[0][0].targetYaw, pitch: nextChallenges[0][0].targetPitch });
    setRotating(false);
    setPhase('ready');
  }

  function beginTurn() {
    if (current) setAngles({ yaw: current.targetYaw, pitch: current.targetPitch });
    setMessage('물체를 누르면 즉시 무게중심이 선택됩니다.');
    setPhase('play');
  }

  function rotateView(deltaYaw: number, deltaPitch: number) {
    if (!current || rotating || sealed) return;
    const from = angles;
    const to = { yaw: from.yaw + deltaYaw, pitch: Math.max(-1.1, Math.min(1.1, from.pitch + deltaPitch)) };
    const startedAt = performance.now();
    setRotating(true);
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 260);
      const eased = 1 - (1 - progress) ** 3;
      setAngles({ yaw: from.yaw + (to.yaw - from.yaw) * eased, pitch: from.pitch + (to.pitch - from.pitch) * eased });
      if (progress < 1) animationRef.current = window.requestAnimationFrame(animate);
      else { animationRef.current = null; setRotating(false); }
    };
    animationRef.current = window.requestAnimationFrame(animate);
  }

  function chooseCenter(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (!current || sealed || rotating) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const guess = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
    const selectedView = { ...current, center: projectMassCenter(current, angles.yaw, angles.pitch), targetYaw: angles.yaw, targetPitch: angles.pitch };
    if (!isCenterHit(selectedView, guess)) {
      setMessage('물체 바깥입니다. 입체 표면 안쪽을 눌러주세요.');
      return;
    }
    const outcome = scoreCenterGuess(player, round, selectedView, guess);
    setOutcomes((items) => [...items, outcome]);
    setSealed(outcome);
    setMessage('선택을 봉인했습니다. 무게중심은 마지막에 공개됩니다.');
    timerRef.current = window.setTimeout(() => {
      setSealed(null);
      if (round + 1 < CENTER_ROUNDS) {
        const next = challenges[player][round + 1];
        setAngles({ yaw: next.targetYaw, pitch: next.targetPitch });
        setMessage('물체를 누르면 즉시 무게중심이 선택됩니다.');
        setRound((value) => value + 1);
      } else if (player + 1 < players) {
        const next = challenges[player + 1][0];
        setAngles({ yaw: next.targetYaw, pitch: next.targetPitch });
        setMessage('물체를 누르면 즉시 무게중심이 선택됩니다.');
        setPlayer((value) => value + 1);
        setRound(0);
        setPhase('ready');
      } else setPhase('final');
    }, 700);
  }

  return <main className="center-shell">
    <header className="center-topbar"><div><p>ROTATE · ONE TAP</p><h1>중심을 찍어라</h1></div><button onClick={onExit}>게임 선택</button></header>

    {phase === 'setup' && <section className="center-setup">
      <div className="center-hero" aria-hidden="true"><i /><span>＋</span><b>↻</b></div>
      <p className="center-kicker">세 번의 3D 무게중심 대결</p><h2>부피를 살피고,<br />무게중심을 찍어라</h2>
      <p>둥근 원석부터 꼬리·가지·여러 혹이 달린 완전 비대칭 물체까지 등장합니다.<br />같은 재질이므로 돌려 보며 더 두껍고 큰 쪽을 찾으세요.</p>
      <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
      <button className="center-primary" onClick={startGame}>무게중심 찾기 시작</button>
      <div className="center-rules"><span>↔ 좌·우 회전</span><span>↕ 상·하 회전</span><span>☝️ 물체를 눌러 선택</span></div>
    </section>}

    {phase === 'ready' && <section className="center-ready"><div className="center-ready-card" style={{ '--center-player': COLORS[player] } as CSSProperties}><div className="center-ready-target"><i /><span>↻</span></div><small>{player + 1}/{players}번째 참가자</small><h2>{PLAYER_NAMES[player]} 차례</h2><p>혼자 화면을 잡고 3개의 입체를 이어서 풉니다.<br />회전 버튼으로 부피를 살펴보고 무게중심을 누르세요.</p><button className="center-primary" onClick={beginTurn}>내 도전 시작</button></div></section>}

    {phase === 'play' && current && <section className="center-play" style={{ '--center-player': COLORS[player] } as CSSProperties}>
      <div className="center-status"><i /><div><small>{PLAYER_NAMES[player]} · {player + 1}/{players}</small><strong>{current.name} · 자유 회전</strong></div><b>{round + 1}<small>/{CENTER_ROUNDS}</small></b></div>
      <div className={`center-board ${sealed ? 'sealed' : ''}`}><span className="center-grid" aria-hidden="true" /><CenterCanvas challenge={current} angles={angles} outcome={sealed ?? undefined} inspect onClick={chooseCenter} /></div>
      <p className={`center-message ${message.startsWith('물체 바깥') ? 'warning' : ''}`}>{message}</p>
      <div className="center-rotation-controls" aria-label="3D 물체 회전">
        <button onClick={() => rotateView(-YAW_STEP, 0)} disabled={Boolean(sealed) || rotating} aria-label="왼쪽으로 회전"><b>←</b><small>좌 회전</small></button>
        <button onClick={() => rotateView(0, -PITCH_STEP)} disabled={Boolean(sealed) || rotating} aria-label="위로 회전"><b>↑</b><small>상 회전</small></button>
        <button onClick={() => rotateView(0, PITCH_STEP)} disabled={Boolean(sealed) || rotating} aria-label="아래로 회전"><b>↓</b><small>하 회전</small></button>
        <button onClick={() => rotateView(YAW_STEP, 0)} disabled={Boolean(sealed) || rotating} aria-label="오른쪽으로 회전"><b>→</b><small>우 회전</small></button>
      </div>
      <div className="center-progress" aria-label={`${CENTER_ROUNDS}라운드 중 ${round + 1}라운드`}>{Array.from({ length: CENTER_ROUNDS }, (_, index) => <i key={index} className={index < round ? 'done' : index === round ? 'current' : ''} />)}</div>
    </section>}

    {phase === 'final' && payer && <section className="center-final">
      <div className="center-payer"><span>☕</span><ResultVerdict results={ranked} /><strong>평균 오차 {(payer.averageError * 100).toFixed(1)}%</strong></div>
      <div className="center-reveal"><p>{PLAYER_NAMES[payer.player]}의 선택 복기</p><div>{payer.outcomes.map((outcome, index) => <article key={outcome.round}><CenterCanvas challenge={outcome.challenge} angles={{ yaw: outcome.challenge.targetYaw, pitch: outcome.challenge.targetPitch }} outcome={outcome} reveal /><small>{index + 1}R · 오차 {(outcome.error * 100).toFixed(1)}%</small></article>)}</div><footer><span><i className="guess" />내 선택</span><span><i className="answer" />무게중심</span></footer></div>
      <ol>{ranked.map((result) => <li key={result.player}><span>{result.rank}</span><i style={{ background: COLORS[result.player] }} /><div><strong>{PLAYER_NAMES[result.player]}</strong><small>평균 오차 {(result.averageError * 100).toFixed(1)}%</small></div><b>{result.score}점</b></li>)}</ol>
      <button className="center-primary" onClick={startGame}>새 입체로 한 판 더</button><button className="center-secondary" onClick={onExit}>게임 선택으로</button>
    </section>}
  </main>;
}
