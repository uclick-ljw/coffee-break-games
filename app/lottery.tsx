'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { makeLotteryTickets, type LotteryTicket } from './lottery-game';

type Phase = 'setup' | 'pick' | 'reveal' | 'result';
type DrawResult = { player: number; ticket: number; winner: boolean };

const confettiColors = ['#ffd447', '#ff4d67', '#5ee7ff', '#9dff6b', '#a67cff', '#ff8c42'];
const playerName = (index: number) => `참가자 ${index + 1}`;

export default function LotteryGame({ onExit }: { onExit: () => void }) {
  const [people, setPeople] = useState(6);
  const [winners, setWinners] = useState(1);
  const [phase, setPhase] = useState<Phase>('setup');
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  const [results, setResults] = useState<DrawResult[]>([]);
  const [turn, setTurn] = useState(0);
  const [selected, setSelected] = useState<LotteryTicket | null>(null);
  const [tear, setTear] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const tearTrackRef = useRef<HTMLDivElement>(null);

  function startGame() {
    setTickets(makeLotteryTickets(people, winners));
    setResults([]);
    setTurn(0);
    setSelected(null);
    setTear(0);
    setRevealed(false);
    setPhase('pick');
  }

  function changePeople(value: number) {
    const next = Math.max(2, Math.min(20, value || 2));
    setPeople(next);
    setWinners((current) => Math.min(current, next));
  }

  function pickTicket(ticket: LotteryTicket) {
    if (phase !== 'pick' || results.some((result) => result.ticket === ticket.id)) return;
    setSelected(ticket);
    setTear(0);
    setRevealed(false);
    setPhase('reveal');
  }

  function rip(value: number) {
    setTear(value);
    if (value < 96 || revealed || !selected) return;
    setRevealed(true);
    setResults((current) => [...current, { player: turn, ticket: selected.id, winner: selected.winner }]);
  }

  function ripAt(clientX: number) {
    const rect = tearTrackRef.current?.getBoundingClientRect();
    if (rect) rip(Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)));
  }

  function moveRip(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) ripAt(event.clientX);
  }

  function keyRip(event: ReactKeyboardEvent<HTMLDivElement>) {
    const next = event.key === 'End' ? 100
      : event.key === 'Home' ? 0
      : event.key === 'ArrowRight' || event.key === 'PageUp' ? tear + 10
      : event.key === 'ArrowLeft' || event.key === 'PageDown' ? tear - 10
      : null;
    if (next === null) return;
    event.preventDefault();
    rip(Math.max(0, Math.min(100, next)));
  }

  function continueGame() {
    if (turn + 1 >= people) {
      setPhase('result');
      return;
    }
    setTurn((current) => current + 1);
    setSelected(null);
    setTear(0);
    setRevealed(false);
    setPhase('pick');
  }

  const opened = new Set(results.map((result) => result.ticket));
  const winnersFound = results.filter((result) => result.winner);

  return (
    <main className={`lottery-shell ${revealed ? (selected?.winner ? 'win-flash' : 'lose-dim') : ''}`}>
      <header className="lottery-topbar">
        <div>
          <p className="lottery-eyebrow">LUCKY RIP</p>
          <h1>뜯어봐!</h1>
        </div>
        <div className="game-actions">
          <button className="lottery-nav" onClick={onExit}>게임 선택</button>
          {phase !== 'setup' && <button className="lottery-nav" onClick={() => setPhase('setup')}>새 게임</button>}
        </div>
      </header>

      {phase === 'setup' && (
        <section className="lottery-setup" aria-labelledby="lottery-setup-title">
          <div className="festival-sign" aria-hidden="true"><span>大</span><b>행운 대축제</b><span>吉</span></div>
          <p className="lottery-kicker">당첨 종이는 정확히 설정한 만큼만 들어갑니다</p>
          <h2 id="lottery-setup-title">오늘의 운을 봉인하세요</h2>
          <div className="lottery-inputs">
            <label>
              <span>참가자</span>
              <input type="number" min="2" max="20" value={people} onChange={(event) => changePeople(Number(event.target.value))} />
              <b>명</b>
            </label>
            <i aria-hidden="true">중</i>
            <label>
              <span>당첨</span>
              <input type="number" min="1" max={people} value={winners} onChange={(event) => setWinners(Math.max(1, Math.min(people, Number(event.target.value) || 1)))} />
              <b>개</b>
            </label>
          </div>
          <button className="lottery-start" onClick={startGame}><span>🎟️</span> 종이 섞고 시작하기</button>
          <p className="lottery-rule">한 명씩 종이를 고르고 절취선을 끝까지 당겨 결과를 확인합니다.</p>
        </section>
      )}

      {phase === 'pick' && (
        <section className="lottery-pick" aria-labelledby="pick-title">
          <div className="lottery-status">
            <span>{turn + 1} / {people}</span>
            <div><small>지금 뽑을 사람</small><h2 id="pick-title">{playerName(turn)}</h2></div>
            <b>당첨 {winners}장</b>
          </div>
          <p>마음이 가는 종이 한 장을 고르세요</p>
          <div className="ticket-wall" aria-label="봉인된 뽑기 종이">
            {tickets.map((ticket, index) => (
              <button
                key={ticket.id}
                className={`sealed-ticket ticket-color-${index % 4} ${opened.has(ticket.id) ? 'opened' : ''}`}
                disabled={opened.has(ticket.id)}
                onClick={() => pickTicket(ticket)}
                aria-label={opened.has(ticket.id) ? `${index + 1}번 종이, 이미 뽑음` : `${index + 1}번 봉인 종이 고르기`}
              >
                <i /><strong>福</strong><span>{opened.has(ticket.id) ? '뜯음' : '봉인'}</span>
              </button>
            ))}
          </div>
          <div className="draw-progress"><i style={{ width: `${results.length / people * 100}%` }} /></div>
        </section>
      )}

      {phase === 'reveal' && selected && (
        <section className={`lottery-reveal ${revealed ? 'is-revealed' : ''}`} aria-live="polite">
          {revealed && selected.winner && <Confetti />}
          <div className={`reveal-ticket ${revealed ? 'revealed' : ''} ${selected.winner ? 'winner' : 'blank'}`}>
            <p>{playerName(turn)}의 선택</p>
            <div className="prize-window">
              <div className="prize-result" hidden={!revealed}>
                <span>{selected.winner ? '🎉' : '💨'}</span>
                <small>{selected.winner ? 'LUCKY!' : 'NEXT TIME'}</small>
                <strong>{selected.winner ? '당첨' : '꽝'}</strong>
              </div>
              {!revealed && (
                <div className="paper-cover" style={{ clipPath: `inset(0 0 0 ${tear}%)` }}>
                  <i>?</i><b>결과 봉인</b><span>끝까지 뜯어주세요</span>
                </div>
              )}
              {!revealed && <div className="tear-edge" style={{ left: `calc(${tear}% - 10px)` }} aria-hidden="true" />}
            </div>
            {!revealed ? (
              <div className="tear-control">
                <span>손잡이를 오른쪽 끝까지 당기세요</span>
                <div
                  ref={tearTrackRef}
                  className="tear-track"
                  role="slider"
                  tabIndex={0}
                  aria-label="절취선을 끝까지 당겨 뜯기"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(tear)}
                  onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); ripAt(event.clientX); }}
                  onPointerMove={moveRip}
                  onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                  onKeyDown={keyRip}
                >
                  <b style={{ left: `calc(${tear}% - 24px)` }}>뜯기</b>
                </div>
              </div>
            ) : (
              <div className="reveal-outcome">
                <strong>{selected.winner ? '대박! 당첨입니다!' : '아쉽지만 꽝입니다'}</strong>
                <button autoFocus onClick={continueGame}>{turn + 1 >= people ? '전체 결과 보기' : '다음 사람 뽑기'}</button>
              </div>
            )}
          </div>
        </section>
      )}

      {phase === 'result' && (
        <section className="lottery-final" aria-labelledby="lottery-result-title">
          <Confetti />
          <span className="final-crown">🏆</span>
          <p>모든 종이를 열었습니다</p>
          <h2 id="lottery-result-title">당첨자 {winnersFound.length}명</h2>
          <div className="winner-list">
            {results.map((result) => <span key={result.player} className={result.winner ? 'hit' : ''}>{result.winner ? '🎉' : '·'} {playerName(result.player)}</span>)}
          </div>
          <button className="lottery-start" onClick={startGame}>같은 설정으로 다시 섞기</button>
          <button className="lottery-secondary" onClick={() => setPhase('setup')}>인원과 당첨 수 바꾸기</button>
        </section>
      )}
    </main>
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
