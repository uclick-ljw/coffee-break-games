'use client';

import { Fragment, lazy, Suspense, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { boardRadius, iceSize, makeIce, PLAYER_NAMES, resolveHit, ROULETTE_RESULTS, type Ice, type RouletteResult } from './game';
import { gameSections, GAMES, pickRandomGame, type GameId, type GameInfo } from './game-catalog';

const MarbleGame = lazy(() => import('./marbles'));
const PegDropGame = lazy(() => import('./pegdrop'));
const LotteryGame = lazy(() => import('./lottery'));
const TimingGame = lazy(() => import('./timing'));
const PerfectCurveGame = lazy(() => import('./circle'));
const TrayGame = lazy(() => import('./tray'));
const DodgeGame = lazy(() => import('./dodge'));
const LanderGame = lazy(() => import('./lander'));
const ParkingGame = lazy(() => import('./parking'));
const SliceGame = lazy(() => import('./slice'));
const ShadowGame = lazy(() => import('./shadow'));
const PathGame = lazy(() => import('./path'));
const CupGame = lazy(() => import('./cups'));
const LunchGame = lazy(() => import('./lunch'));
const CenterGame = lazy(() => import('./center'));
const BombGame = lazy(() => import('./bomb'));
const MeasureGame = lazy(() => import('./measure'));
const DartGame = lazy(() => import('./dart'));
const BalloonGame = lazy(() => import('./balloon'));
const PopGame = lazy(() => import('./puzzles').then((module) => ({ default: module.PopGame })));
const UntangleGame = lazy(() => import('./puzzles').then((module) => ({ default: module.UntangleGame })));
const CatGame = lazy(() => import('./puzzles').then((module) => ({ default: module.CatGame })));
const SandGame = lazy(() => import('./sand'));
const HoleGame = lazy(() => import('./arcade').then((module) => ({ default: module.HoleGame })));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ROULETTE_LABELS: Record<RouletteResult, string> = {
  blue: '파란 얼음',
  white: '하얀 얼음',
  any: '아무 얼음',
  pass: '차례 통과',
};

type GameMode = 'home' | 'menu' | 'guide' | GameId;
type GameComponent = ComponentType<{ onExit: () => void }>;

const GAME_VIEWS: Record<GameId, { component: GameComponent; loading: string }> = {
  ice: { component: IceGame, loading: '얼음판을 준비하고 있습니다…' },
  marbles: { component: MarbleGame, loading: '3D 타워를 준비하고 있습니다…' },
  pegdrop: { component: PegDropGame, loading: '게임판을 준비하고 있습니다…' },
  lottery: { component: LotteryGame, loading: '행운 종이를 섞고 있습니다…' },
  timing: { component: TimingGame, loading: '스톱워치를 맞추고 있습니다…' },
  circle: { component: PerfectCurveGame, loading: '별빛 캔버스를 펼치고 있습니다…' },
  tray: { component: TrayGame, loading: '균형 쟁반을 준비하고 있습니다…' },
  dodge: { component: DodgeGame, loading: '동물 친구들을 깨우고 있습니다…' },
  lander: { component: LanderGame, loading: '착륙장을 준비하고 있습니다…' },
  parking: { component: ParkingGame, loading: '주차장을 열고 있습니다…' },
  slice: { component: SliceGame, loading: '자를 물체를 고르고 있습니다…' },
  shadow: { component: ShadowGame, loading: '비밀 조형물을 꺼내고 있습니다…' },
  path: { component: PathGame, loading: '탈출 경로를 숨기고 있습니다…' },
  cups: { component: CupGame, loading: '컵 아래 구슬을 숨기고 있습니다…' },
  lunch: { component: LunchGame, loading: '도시락 반찬을 준비하고 있습니다…' },
  center: { component: CenterGame, loading: '불규칙한 물체를 준비하고 있습니다…' },
  bomb: { component: BombGame, loading: '폭탄 숫자를 숨기고 있습니다…' },
  measure: { component: MeasureGame, loading: '눈금을 지우고 있습니다…' },
  dart: { component: DartGame, loading: '회전판을 돌리고 있습니다…' },
  balloon: { component: BalloonGame, loading: '풍선에 바람을 넣고 있습니다…' },
  pop: { component: PopGame, loading: '블록을 섞고 있습니다…' },
  untangle: { component: UntangleGame, loading: '선을 엉키고 있습니다…' },
  cat: { component: CatGame, loading: '고양이의 탈출로를 준비하고 있습니다…' },
  sand: { component: SandGame, loading: '모래와 구슬을 준비하고 있습니다…' },
  hole: { component: HoleGame, loading: '장난감을 펼치고 있습니다…' },
};

function GameArt({ game }: { game: GameInfo }) {
  return (
    <span className={['game-card-art', game.artClass].filter(Boolean).join(' ')} aria-hidden="true">
      {game.id === 'center' && <i />}
      {game.icon}
    </span>
  );
}

export default function Home() {
  const [mode, setMode] = useState<GameMode>('home');
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [pickSource, setPickSource] = useState<'direct' | 'random'>('direct');
  const [isPicking, setIsPicking] = useState(false);
  const pickingRef = useRef(false);

  const showGuide = (game: GameInfo, source: 'direct' | 'random') => {
    setSelectedGame(game);
    setPickSource(source);
    setMode('guide');
  };

  const chooseRandomGame = async () => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    const previousId = selectedGame?.id;
    setPickSource('random');
    setIsPicking(true);
    setSelectedGame(pickRandomGame());
    setMode('guide');

    try {
      for (let step = 0; step < 8; step += 1) {
        setSelectedGame(pickRandomGame());
        await wait(55 + step * 15);
      }
      setSelectedGame(pickRandomGame(previousId));
    } finally {
      setIsPicking(false);
      pickingRef.current = false;
    }
  };

  if (mode !== 'home' && mode !== 'menu' && mode !== 'guide') {
    const view = GAME_VIEWS[mode];
    const Game = view.component;
    return (
      <Suspense fallback={<main className="menu-shell"><p className="menu-note">{view.loading}</p></main>}>
        <Game onExit={() => setMode('menu')} />
      </Suspense>
    );
  }

  if (mode === 'guide' && selectedGame) {
    return (
      <main className="guide-shell">
        <header className="guide-topbar">
          <button type="button" onClick={() => setMode('home')}>처음 화면</button>
          <span>{GAMES.length} GAMES</span>
        </header>

        <section
          key={selectedGame.id}
          className={['guide-card', selectedGame.id + '-card', isPicking ? 'is-picking' : ''].join(' ')}
          aria-live="polite"
          aria-busy={isPicking}
        >
          <p className="guide-pick-state">{isPicking ? '게임을 고르는 중…' : pickSource === 'random' ? '오늘의 랜덤 게임' : '게임 설명'}</p>
          <div className="guide-art"><GameArt game={selectedGame} /></div>
          <small>{selectedGame.kicker}</small>
          <h1>{selectedGame.title}</h1>
          <p className="guide-description">{selectedGame.description}</p>

          <div className="guide-meta" aria-label="게임 기본 정보">
            <span>👥 {selectedGame.players}</span>
            <span>⏱ {selectedGame.time}</span>
          </div>

          <div className="guide-rules">
            <section>
              <span>목표</span>
              <p>{selectedGame.goal}</p>
            </section>
            <section>
              <span>조작</span>
              <p>{selectedGame.controls}</p>
            </section>
            <section>
              <span>승부</span>
              <p>{selectedGame.result}</p>
            </section>
          </div>

          <div className="guide-actions">
            <button
              type="button"
              className="guide-primary"
              disabled={isPicking}
              onClick={() => setMode(selectedGame.id)}
            >
              {isPicking ? '고르는 중…' : '이 게임 시작'}
            </button>
            {pickSource === 'random' && (
              <button type="button" className="guide-secondary" disabled={isPicking} onClick={chooseRandomGame}>
                다시 뽑기
              </button>
            )}
            <button type="button" className="guide-secondary" disabled={isPicking} onClick={() => setMode('menu')}>
              목록에서 고르기
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (mode === 'menu') {
    return (
      <main className="menu-shell">
        <header className="menu-hero">
          <button type="button" className="menu-home-button" onClick={() => setMode('home')}>← 처음 화면</button>
          <p className="eyebrow">CHOOSE YOUR GAME</p>
          <h1>게임 고르기</h1>
          <p>비슷한 방식끼리 모아두었습니다. 카드를 누르면 규칙부터 보여드려요.</p>
        </header>
        <section className="game-grid" aria-label="게임 선택">
          {gameSections().map((category) => (
            <Fragment key={category.id}>
              <header className={'game-cluster-heading' + (category.id === 'new' ? ' new-games-heading' : '')}>
                <span>{category.icon}</span>
                <div><h2>{category.title}</h2><p>{category.description}</p></div>
              </header>
              {category.games.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className={'game-card ' + game.id + '-card'}
                  aria-label={game.title + ' 설명 보기'}
                  onClick={() => showGuide(game, 'direct')}
                >
                  <GameArt game={game} />
                  <small>{game.kicker}</small>
                  <strong>{game.title}</strong>
                  <p>{game.description}</p>
                  <b>{game.action}</b>
                </button>
              ))}
            </Fragment>
          ))}
        </section>
        <p className="menu-note">설명은 짧게, 한 판은 가볍게. 인원에 따라 플레이 시간이 달라져요.</p>
      </main>
    );
  }

  return (
    <main className="launch-shell">
      <section className="launch-panel" aria-labelledby="launch-title">
        <div className="launch-badge" aria-hidden="true">☕</div>
        <p className="eyebrow">ONE MINUTE BOARD GAMES</p>
        <h1 id="launch-title">커피 한 판</h1>
        <p className="launch-intro">한 기기로 돌려가며 즐기는 짧고 빠른 내기 게임</p>

        <div className="launch-actions">
          <button type="button" className="launch-choice launch-random" onClick={chooseRandomGame}>
            <span aria-hidden="true">🎲</span>
            <strong>랜덤으로 골라줘</strong>
            <small>고민 없이 오늘의 게임 뽑기</small>
          </button>
          <button type="button" className="launch-choice launch-browse" onClick={() => setMode('menu')}>
            <span aria-hidden="true">🗂️</span>
            <strong>게임 직접 고르기</strong>
            <small>종류와 설명을 보고 선택하기</small>
          </button>
        </div>

        <p className="launch-count"><b>{GAMES.length}개</b>의 짧은 게임 · 2~6명 · 소리 없이 플레이</p>
      </section>
    </main>
  );
}

function initialGame(round: number, players: number) {
  return makeIce(players, 20260821 + round * 97 + players * 13);
}

function IceGame({ onExit }: { onExit: () => void }) {
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
  const [hammer, setHammer] = useState<string | null>(null);
  const [shake, setShake] = useState<'' | 'small' | 'large'>('');
  const [penguinMood, setPenguinMood] = useState<'calm' | 'tense' | 'panic'>('calm');
  const [muted, setMuted] = useState(true);
  const [roulette, setRoulette] = useState<RouletteResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const remaining = useMemo(() => ice.filter((tile) => tile.state === 'solid').length, [ice]);
  const radius = boardRadius(players);
  const completedCycles = Math.floor((move - 1) / players);

  function audioContext() {
    if (muted) return null;
    audioRef.current ??= new AudioContext();
    if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    return audioRef.current;
  }

  function tone(start: number, end: number, duration: number, type: OscillatorType, volume: number) {
    const context = audioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function canHit(tile: Ice) {
    return tile.state === 'solid' && (roulette === 'any' || roulette === tile.color);
  }

  const needsRespin = roulette === 'blue' || roulette === 'white'
    ? !ice.some((tile) => tile.state === 'solid' && tile.color === roulette)
    : false;

  async function spinRoulette() {
    if (busy || spinning || loser !== null || (roulette !== null && !needsRespin)) return;
    setSpinning(true);
    setRoulette(null);
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const result = ROULETTE_RESULTS[random % ROULETTE_RESULTS.length];
    const targetAngle = -ROULETTE_RESULTS.indexOf(result) * 90;
    setWheelRotation((current) => current + 1440 + ((targetAngle - current % 360 + 360) % 360));
    await wait(850);
    setRoulette(result);
    if (result === 'pass') {
      await wait(700);
      setPlayer((current) => (current + 1) % players);
      setRoulette(null);
    }
    setSpinning(false);
  }

  async function breakIce(id: string) {
    if (busy || spinning || loser !== null) return;
    if (!ice.some((tile) => tile.id === id && canHit(tile))) return;
    setBusy(true);
    audioContext();
    const { final, steps } = resolveHit(ice, id, move, players);

    setHammer(id);
    setPenguinMood('tense');
    await wait(140);
    tone(150, 70, 0.08, 'square', 0.07);
    setShake('small');
    setFalling([id]);
    setIce((current) => current.map((tile) => tile.id === id ? { ...tile, state: 'gone' } : tile));
    await wait(80);
    setHammer(null);
    setShake('');

    for (const step of steps) {
      setFalling([]);
      setPulse(step.affected);
      setPenguinMood('tense');
      tone(680, 360, 0.08, 'triangle', 0.025);
      await wait(140);
      if (step.falling.length) {
        setPulse([]);
        setFalling(step.falling);
        setShake(step.falling.length >= 4 ? 'large' : 'small');
        setPenguinMood(step.falling.length >= 4 ? 'panic' : 'tense');
        tone(110, 35, 0.18, 'sawtooth', Math.min(0.12, 0.04 + step.falling.length * 0.01));
        setIce((current) => current.map((tile) => step.falling.includes(tile.id) ? { ...tile, state: 'gone' } : tile));
        await wait(140);
        setShake('');
      }
    }

    setIce(final);
    setPulse([]);
    setFalling([]);
    setHammer(null);
    setShake('');
    setPenguinMood('calm');
    const penguinFell = final.find((tile) => tile.id === '0:0')?.state === 'gone';
    setBusy(false);
    if (penguinFell) setLoser(player);
    else {
      setPlayer((current) => (current + 1) % players);
      setMove((current) => current + 1);
      setRoulette(null);
    }
  }

  function restart(nextPlayers = players) {
    if (busy || spinning) return;
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
    setHammer(null);
    setShake('');
    setPenguinMood('calm');
    setRoulette(null);
    setSpinning(false);
    setWheelRotation(0);
  }

  const boardStyle = { '--ice-size': `${iceSize(radius)}%` } as CSSProperties;
  const penguinSize = radius === 2 ? 60 : radius === 3 ? 48 : 38;
  const hammerTarget = ice.find((tile) => tile.id === hammer);
  const instruction = roulette === 'pass' ? '이번 차례는 통과!'
    : spinning ? '룰렛이 돌아갑니다…'
    : roulette === null ? '먼저 룰렛을 돌리세요'
    : needsRespin ? `${ROULETTE_LABELS[roulette]}이 없습니다`
    : `${ROULETTE_LABELS[roulette]}을 고르세요`;

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">QUICK ICE GAME</p>
          <h1>얼음 한 판</h1>
        </div>
        <div className="game-actions">
          <button className="restart-small" disabled={busy || spinning} onClick={onExit}>게임 선택</button>
          <label className="player-select">
            <span>인원</span>
            <select value={players} disabled={busy || spinning} onChange={(event) => restart(Number(event.target.value))}>
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명</option>
              <option value={5}>5명</option>
              <option value={6}>6명</option>
            </select>
          </label>
          <button
            className="sound-toggle"
            disabled={busy || spinning}
            aria-label={muted ? '소리 켜기' : '음소거'}
            aria-pressed={muted}
            onClick={() => setMuted((current) => !current)}
          >{muted ? '🔇' : '🔊'}</button>
          <button className="restart-small" disabled={busy || spinning} onClick={() => restart()}>새 게임</button>
        </div>
      </header>

      <section className="status-card" aria-live="polite">
        <div className={`player-dot player-${player}`} />
        <div>
          <span>{loser === null ? `${PLAYER_NAMES[player]} 차례` : `${PLAYER_NAMES[loser]} 패배`}</span>
          <strong>{loser === null ? (busy ? '충격이 퍼집니다…' : instruction) : '펭귄이 빠졌습니다!'}</strong>
        </div>
        <div className="move-count"><span>타격</span><b>{move}</b></div>
      </section>

      <section className="roulette-panel" aria-label="타격 룰렛">
        <div className="wheel-shell">
          <i className="wheel-pointer" />
          <div className="roulette-wheel" style={{ transform: `rotate(${wheelRotation}deg)` }}>
            <span>파랑</span><span>하양</span><span>자유</span><span>통과</span>
          </div>
        </div>
        <div className="roulette-action">
          <b>{roulette ? ROULETTE_LABELS[roulette] : '오늘의 운명'}</b>
          <button onClick={spinRoulette} disabled={busy || spinning || loser !== null || (roulette !== null && !needsRespin)}>
            {roulette === 'pass' ? '차례 통과' : spinning ? '도는 중…' : needsRespin ? '다시 돌리기' : '룰렛 돌리기'}
          </button>
        </div>
      </section>

      <section className="board-wrap" aria-label={`${players}인용 얼음 게임판`}>
        <div className="cold-meter" aria-label={`한기 단계 ${Math.min(3, Math.floor(completedCycles / 2) + 1)}`}>
          <i style={{ width: `${Math.min(100, 25 + completedCycles * 15)}%` }} />
        </div>
        <div className={`board board-${players} ${shake ? `shake-${shake}` : ''}`} style={boardStyle}>
          <div className="water-ripple" />
          {ice.map((tile) => (
            <button
              key={tile.id}
              className={`ice ${tile.color} ${tile.state} ${roulette && !canHit(tile) ? 'unavailable' : ''} ${pulse.includes(tile.id) ? 'pulse' : ''} ${falling.includes(tile.id) ? 'falling' : ''}`}
              style={{ left: `${tile.x}%`, top: `${tile.y}%` }}
              onClick={() => breakIce(tile.id)}
              disabled={busy || spinning || loser !== null || !canHit(tile)}
              aria-label={`${tile.color === 'blue' ? '파란' : '하얀'} ${tile.id === '0:0' ? '펭귄이 있는 얼음' : '얼음'}`}
            />
          ))}
          {hammerTarget && (
            <span className="hammer" style={{ left: `${hammerTarget.x}%`, top: `${hammerTarget.y}%` }} aria-hidden="true">🔨</span>
          )}
          <div
            className={`penguin ${ice.find((tile) => tile.id === '0:0')?.state === 'gone' ? 'dropped' : penguinMood}`}
            style={{ fontSize: `${penguinSize}px` }}
            aria-label="펭귄"
          >🐧</div>
        </div>
        <p className="rule">룰렛이 정한 색만 깨세요. 균열은 타격 전까지 보이지 않습니다.</p>
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
            <span>{move}번의 타격으로 끝났어요.</span>
            <button autoFocus onClick={() => restart()}>한 판 더</button>
          </div>
        </div>
      )}
    </main>
  );
}
