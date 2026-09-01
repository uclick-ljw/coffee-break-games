'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PLAYER_NAMES } from './game';
import { BOMB_MAX, BOMB_MIN, BOMB_TURN_MS, makeBombRound, playableBounds, resolveBombPick } from './bomb-game';

type Phase = 'setup' | 'play' | 'checking' | 'exploded';
const COLORS = ['#27c9e8', '#ff8b4c', '#a980f4', '#54d18e', '#f462a0', '#f1cf4e'];
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const clock = () => performance.now();
const numbers = Array.from({ length: BOMB_MAX }, (_, index) => index + 1);

export default function BombGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState(2);
  const [player, setPlayer] = useState(0);
  const [bomb, setBomb] = useState(50);
  const [low, setLow] = useState(BOMB_MIN);
  const [high, setHigh] = useState(BOMB_MAX);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'UP' | 'DOWN' | null>(null);
  const [loser, setLoser] = useState<number | null>(null);
  const [timeout, setTimeoutLoss] = useState(false);
  const [turns, setTurns] = useState(1);
  const [deadline, setDeadline] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BOMB_TURN_MS);
  const playable = useMemo(() => playableBounds(low, high), [high, low]);

  useEffect(() => {
    if (phase !== 'play') return;
    let expired = false;
    const tick = () => {
      const remaining = Math.max(0, deadline - clock());
      setTimeLeft(remaining);
      if (remaining === 0 && !expired) {
        expired = true;
        setTimeoutLoss(true);
        setLoser(player);
        setPhase('exploded');
      }
    };
    tick();
    const timer = window.setInterval(tick, 50);
    return () => window.clearInterval(timer);
  }, [deadline, phase, player]);

  function startGame() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const round = makeBombRound(players, seed);
    setBomb(round.bomb);
    setPlayer(round.starter);
    setLow(BOMB_MIN);
    setHigh(BOMB_MAX);
    setSelected(null);
    setFeedback(null);
    setLoser(null);
    setTimeoutLoss(false);
    setTurns(1);
    setTimeLeft(BOMB_TURN_MS);
    setDeadline(clock() + BOMB_TURN_MS);
    setPhase('play');
  }

  async function chooseNumber(choice: number) {
    if (phase !== 'play') return;
    const result = resolveBombPick({ bomb, low, high }, choice);
    setSelected(choice);
    setPhase('checking');
    await wait(340);
    if (result.hit) {
      setLoser(player);
      setPhase('exploded');
      return;
    }
    setFeedback(result.direction);
    await wait(520);
    setLow(result.low);
    setHigh(result.high);
    setSelected(null);
    setFeedback(null);
    setPlayer((current) => (current + 1) % players);
    setTurns((current) => current + 1);
    setTimeLeft(BOMB_TURN_MS);
    setDeadline(clock() + BOMB_TURN_MS);
    setPhase('play');
  }

  return <main className={`bomb-shell ${phase === 'exploded' ? 'exploded' : ''}`} style={{ '--bomb-player': COLORS[player] } as CSSProperties}>
    <header className="bomb-topbar"><div><p>FIND IT · YOU LOSE</p><h1>숫자 폭탄</h1></div><button onClick={onExit}>게임 선택</button></header>

    {phase === 'setup' && <section className="bomb-setup">
      <div className="bomb-hero" aria-hidden="true"><span>💣</span><i /><i /><i /></div>
      <p className="bomb-kicker">정확히 맞히면 폭발</p><h2>숫자를 피해<br />다음 사람에게 넘겨라</h2>
      <p>UP·DOWN으로 범위가 줄어듭니다.<br />숨은 숫자를 누르거나 6초를 넘기면 커피 담당!</p>
      <label>참가 인원<select value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}명</option>)}</select></label>
      <button className="bomb-primary" onClick={startGame}>폭탄 숨기기</button>
      <div className="bomb-rules"><span>🎯 중앙 60%만 선택</span><span>⏱️ 턴당 6초</span><span>💥 맞히면 패배</span></div>
    </section>}

    {(phase === 'play' || phase === 'checking') && <section className={`bomb-play ${phase}`}>
      <div className="bomb-turn"><i /><div><small>{player + 1}/{players}번째 참가자 · {turns}턴</small><strong>{PLAYER_NAMES[player]} 차례</strong></div><b>{Math.ceil(timeLeft / 1000)}<small>초</small></b></div>
      <div className="bomb-fuse" aria-label={`남은 시간 ${Math.ceil(timeLeft / 1000)}초`}><i style={{ width: `${timeLeft / BOMB_TURN_MS * 100}%` }}><span>🔥</span></i></div>
      <div className="bomb-range" key={`${low}-${high}`}><small>폭탄이 숨어 있는 범위</small><div><b>{low}</b><span>—</span><b>{high}</b></div><p>{playable.low}부터 {playable.high}까지 선택 가능</p></div>
      <div className="bomb-board" aria-label="숫자 선택판">
        {numbers.map((number) => {
          const inRange = number >= low && number <= high;
          const canPick = number >= playable.low && number <= playable.high;
          return <button key={number} className={`${!inRange ? 'out' : canPick ? 'live' : 'locked'} ${selected === number ? 'selected' : ''}`} disabled={phase !== 'play' || !canPick} onClick={() => chooseNumber(number)} aria-label={`${number}${canPick ? ' 선택 가능' : ' 선택 불가'}`}>{number}</button>;
        })}
        {feedback && <div className={`bomb-feedback ${feedback.toLowerCase()}`}><span>{feedback === 'UP' ? '↑' : '↓'}</span><strong>{feedback}</strong><small>{selected}보다 {feedback === 'UP' ? '높다' : '낮다'}!</small></div>}
      </div>
      <p className="bomb-tip">가장자리 안전 선택은 잠겨 있습니다. 빛나는 숫자 중 하나를 고르세요.</p>
    </section>}

    {phase === 'exploded' && loser !== null && <section className="bomb-result" role="dialog" aria-modal="true" aria-labelledby="bomb-result-title">
      <div className="bomb-flash" /><div className="bomb-blast" aria-hidden="true"><span>💥</span>{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--particle': index } as CSSProperties} />)}</div>
      <div className="bomb-result-card"><p>{timeout ? '시간 초과' : `${selected} · 폭탄 숫자`}</p><h2 id="bomb-result-title">{PLAYER_NAMES[loser]} 폭발!</h2><div className="bomb-reveal"><span>숨겨진 숫자</span><strong>{bomb}</strong></div><b>오늘의 커피 담당</b><button className="bomb-primary" onClick={startGame}>다시 숨기기</button><button className="bomb-secondary" onClick={onExit}>게임 선택으로</button></div>
    </section>}
  </main>;
}
