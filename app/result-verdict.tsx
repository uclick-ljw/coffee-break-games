import { PLAYER_NAMES } from './game';
import { lastPlace } from './ranking';

export function ResultVerdict({ results, numbered = false }: { results: { player: number; rank: number }[]; numbered?: boolean }) {
  const last = lastPlace(results);
  const tied = last.length > 1;
  return <>
    <p>{tied ? last.length === results.length ? '모두 동점' : '공동 최하위' : '오늘의 커피 담당'}</p>
    <h2 className="result-names">{last.map(({ player }) => numbered ? `참가자 ${player + 1}` : PLAYER_NAMES[player]).join(' · ')}</h2>
    {tied && <small className="result-tie-note">공동 순위입니다. 한 명을 정하려면 한 판 더!</small>}
  </>;
}
