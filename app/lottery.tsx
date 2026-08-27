'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { makeLotteryTickets, type LotteryTicket } from './lottery-game';

type Phase = 'setup' | 'pick' | 'reveal' | 'result';
type DrawResult = { player: number; ticket: number; penalty: boolean };

const confettiColors = ['#e3b13f', '#c64b40', '#2c7790', '#2f6d68', '#f2e6c8', '#374f7d'];
const SCRATCH_COMPLETE = 40;
const playerName = (index: number) => `참가자 ${index + 1}`;

export default function LotteryGame({ onExit }: { onExit: () => void }) {
  const [people, setPeople] = useState(6);
  const [penalties, setPenalties] = useState(1);
  const [phase, setPhase] = useState<Phase>('setup');
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [results, setResults] = useState<DrawResult[]>([]);
  const [turn, setTurn] = useState(0);
  const [selected, setSelected] = useState<LotteryTicket | null>(null);
  const [revealed, setRevealed] = useState(false);

  function startGame() {
    setTickets(makeLotteryTickets(people, penalties));
    setResults([]);
    setTurn(0);
    setSelected(null);
    setRevealed(false);
    setPhase('pick');
  }

  function changePeople(value: number) {
    const next = Math.max(2, Math.min(20, value || 2));
    setPeople(next);
    setPenalties((current) => Math.min(current, next));
  }

  function pickTicket(ticket: LotteryTicket) {
    if (phase !== 'pick' || results.some((result) => result.ticket === ticket.id)) return;
    setSelected(ticket);
    setRevealed(false);
    setPhase('reveal');
  }

  function revealSelected() {
    if (revealed || !selected) return;
    setRevealed(true);
    setResults((current) => [...current, { player: turn, ticket: selected.id, penalty: selected.penalty }]);
  }

  function continueGame() {
    if (turn + 1 >= people) {
      setPhase('result');
      return;
    }
    setTurn((current) => current + 1);
    setSelected(null);
    setRevealed(false);
    setPhase('pick');
  }

  const opened = new Set(results.map((result) => result.ticket));
  const penaltiesFound = results.filter((result) => result.penalty);

  return (
    <main className="lottery-shell">
      <header className="lottery-topbar">
        <div>
          <p className="lottery-eyebrow">오늘의 복불복</p>
          <h1>긁어봐!</h1>
        </div>
        <div className="game-actions">
          <button className="lottery-nav" onClick={onExit}>게임 선택</button>
          {phase !== 'setup' && <button className="lottery-nav" onClick={() => setPhase('setup')}>새 게임</button>}
        </div>
      </header>

      {phase === 'setup' && (
        <section className="lottery-setup" aria-labelledby="lottery-setup-title">
          <div className="festival-sign" aria-hidden="true">
            <span>오늘</span>
            <div><b>복불복 한판</b><small>긁어서 정하는 오늘의 한턱</small></div>
            <Image src="/korean-lottery-mascot.png" alt="" width={640} height={640} priority />
          </div>
          <p className="lottery-kicker">꽝 복권은 설정한 수만큼 정확히 들어갑니다</p>
          <h2 id="lottery-setup-title">몇 명이서, 몇 명이 살까요?</h2>
          <div className="lottery-inputs">
            <label>
              <span>참가자</span>
              <input type="number" min="2" max="20" value={people} onChange={(event) => changePeople(Number(event.target.value))} />
              <b>명</b>
            </label>
            <i aria-hidden="true">중</i>
            <label>
              <span>꽝</span>
              <input type="number" min="1" max={people} value={penalties} onChange={(event) => setPenalties(Math.max(1, Math.min(people, Number(event.target.value) || 1)))} />
              <b>개</b>
            </label>
          </div>
          <button className="lottery-start" onClick={startGame}><span>☕</span> 한턱 복권 섞기</button>
          <p className="lottery-rule">한 명씩 복권을 고르고 은색 코팅을 손가락으로 긁어 결과를 확인합니다.</p>
        </section>
      )}

      {phase === 'pick' && (
        <section className="lottery-pick" aria-labelledby="pick-title">
          <div className="lottery-status">
            <span>차례 {turn + 1} / {people}</span>
            <div><small>지금 뽑을 사람</small><h2 id="pick-title">{playerName(turn)}</h2></div>
            <b>꽝 {penalties}장</b>
          </div>
          <div className="pick-intro">
            <Image src="/korean-lottery-mascot.png" alt="" width={640} height={640} />
            <p>마음이 가는 한턱 복권<br />한 장을 고르세요</p>
          </div>
          <div className="ticket-wall" aria-label="스크래치 복권">
            {tickets.map((ticket, index) => (
              <button
                key={ticket.id}
                className={`sealed-ticket ticket-color-${index % 4} ${opened.has(ticket.id) ? 'opened' : ''}`}
                disabled={opened.has(ticket.id)}
                onClick={() => pickTicket(ticket)}
                aria-label={opened.has(ticket.id) ? `${index + 1}번 복권, 이미 긁음` : `${index + 1}번 스크래치 복권 고르기`}
              >
                <i /><strong>복</strong><span>{opened.has(ticket.id) ? '확인 완료' : '한턱 복권'}</span>
              </button>
            ))}
          </div>
          <div className="draw-progress"><i style={{ width: `${results.length / people * 100}%` }} /></div>
        </section>
      )}

      {phase === 'reveal' && selected && (
        <section className={`lottery-reveal ${revealed ? 'is-revealed' : ''}`} aria-live="polite">
          {revealed && selected.penalty && <Confetti />}
          <div className={`reveal-ticket ${revealed ? 'revealed' : ''} ${selected.penalty ? 'bust' : 'pass'}`}>
            <p>{playerName(turn)}의 선택</p>
            <div className="prize-window">
              <div className="prize-result" aria-hidden={!revealed}>
                <span>{selected.penalty ? '💥' : '😮‍💨'}</span>
                <small>{selected.penalty ? 'OH NO!' : 'SAFE!'}</small>
                <strong>{selected.penalty ? '꽝' : '패스'}</strong>
              </div>
              {!revealed && <ScratchCover key={`${turn}:${selected.id}`} onComplete={revealSelected} />}
            </div>
            {!revealed ? (
              <p className="scratch-guide">회색 코팅을 손가락으로 여러 번 문질러 벗기세요.</p>
            ) : (
              <div className="reveal-outcome">
                <strong>{selected.penalty ? '걸렸다! 오늘은 네가 삽니다!' : '휴—이번에는 패스!'}</strong>
                <button autoFocus onClick={continueGame}>{turn + 1 >= people ? '전체 결과 보기' : '다음 사람 뽑기'}</button>
              </div>
            )}
          </div>
        </section>
      )}

      {phase === 'result' && (
        <section className="lottery-final" aria-labelledby="lottery-result-title">
          <Confetti />
          <span className="final-crown">☕</span>
          <p>모든 종이를 열었습니다</p>
          <h2 id="lottery-result-title">오늘 살 사람 {penaltiesFound.length}명</h2>
          <div className="penalty-list">
            {results.map((result) => <span key={result.player} className={result.penalty ? 'bust' : ''}>{result.penalty ? '💣' : '✓'} {playerName(result.player)}</span>)}
          </div>
          <button className="lottery-start" onClick={startGame}>같은 설정으로 다시 섞기</button>
          <button className="lottery-secondary" onClick={() => setPhase('setup')}>인원과 꽝 수 바꾸기</button>
        </section>
      )}
    </main>
  );
}

function ScratchCover({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchedRef = useRef(new Set<number>());
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#e7e9ed');
    gradient.addColorStop(.45, '#9da4ad');
    gradient.addColorStop(1, '#d8dbe0');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#ffffff42';
    context.lineWidth = 13;
    for (let x = -canvas.height; x < canvas.width; x += 54) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + canvas.height, canvas.height);
      context.stroke();
    }
    context.textAlign = 'center';
    context.fillStyle = '#4f5660';
    context.font = '900 38px Arial';
    context.fillText('SCRATCH', canvas.width / 2, 175);
    context.font = '900 58px Arial, sans-serif';
    context.fillText('긁어서 확인', canvas.width / 2, 250);
    context.font = '700 24px Arial, sans-serif';
    context.fillText('동전 대신 손가락으로 문질러요', canvas.width / 2, 305);
  }, []);

  function scratch(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || completedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: (clientX - rect.left) / rect.width * canvas.width, y: (clientY - rect.top) / rect.height * canvas.height };
    const previous = lastPointRef.current ?? point;
    context.globalCompositeOperation = 'destination-out';
    context.lineCap = 'round';
    context.lineWidth = 48;
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;

    const columns = 20;
    const rows = 14;
    const steps = Math.max(1, Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / 24));
    for (let step = 0; step <= steps; step += 1) {
      const x = previous.x + (point.x - previous.x) * step / steps;
      const y = previous.y + (point.y - previous.y) * step / steps;
      for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
        const dx = (column + .5) * canvas.width / columns - x;
        const dy = (row + .5) * canvas.height / rows - y;
        if (dx * dx + dy * dy < 26 * 26) scratchedRef.current.add(row * columns + column);
      }
    }
    const nextProgress = Math.round(scratchedRef.current.size / (columns * rows) * 100);
    setProgress(nextProgress);
    if (nextProgress >= SCRATCH_COMPLETE) {
      completedRef.current = true;
      onComplete();
    }
  }

  function keyScratch(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'End') return;
    event.preventDefault();
    completedRef.current = true;
    setProgress(100);
    onComplete();
  }

  const tensionText = progress < 8
    ? '천천히 긁어보세요'
    : progress < 20
      ? '무언가 보입니다…'
      : progress < 33
        ? '결과가 드러나고 있어요'
        : '조금만 더…';

  return (
    <div className="scratch-cover">
      <canvas
        ref={canvasRef}
        className="scratch-canvas"
        width="640"
        height="440"
        role="button"
        tabIndex={0}
        aria-label="회색 코팅을 긁어 결과 확인"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); lastPointRef.current = null; scratch(event.clientX, event.clientY); }}
        onPointerMove={(event: ReactPointerEvent<HTMLCanvasElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) scratch(event.clientX, event.clientY); }}
        onPointerUp={(event) => { lastPointRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
        onKeyDown={keyScratch}
      />
      <span className="scratch-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, progress / SCRATCH_COMPLETE * 100)}%` }} />{progress}% · {tensionText}</span>
    </div>
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 48 }, (_, index) => (
        <i key={index} style={{
          left: `${(index * 37) % 100}%`,
          background: confettiColors[index % confettiColors.length],
          '--confetti-x': `${(index * 53) % 180 - 90}px`,
          '--confetti-rotate': `${index * 71}deg`,
          '--confetti-delay': `${(index % 9) * .045}s`,
        } as CSSProperties} />
      ))}
    </div>
  );
}
