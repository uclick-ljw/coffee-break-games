export type GameCategoryId = 'luck' | 'skill' | 'eye' | 'strategy';

export type GameId =
  | 'ice'
  | 'marbles'
  | 'pegdrop'
  | 'lottery'
  | 'bomb'
  | 'balloon'
  | 'timing'
  | 'dart'
  | 'dodge'
  | 'lander'
  | 'parking'
  | 'measure'
  | 'circle'
  | 'slice'
  | 'center'
  | 'shadow'
  | 'cups'
  | 'tray'
  | 'path'
  | 'lunch'
  | 'pop'
  | 'untangle'
  | 'cat'
  | 'domino';

export type GameInfo = {
  id: GameId;
  category: GameCategoryId;
  icon: string;
  artClass?: string;
  kicker: string;
  title: string;
  description: string;
  action: string;
  players: string;
  time: string;
  goal: string;
  controls: string;
  result: string;
};

export const GAME_CATEGORIES = [
  { id: 'luck', icon: '🎲', title: '운과 반전', description: '결과를 예측할 수 없는 짜릿한 한 판' },
  { id: 'skill', icon: '⚡', title: '손끝과 순간 감각', description: '짧은 판단과 정확한 조작으로 승부' },
  { id: 'eye', icon: '👀', title: '눈대중과 집중', description: '보고 기억하고 가장 정확하게 맞히기' },
  { id: 'strategy', icon: '🧩', title: '배치와 전략', description: '공간을 읽고 가장 좋은 수를 선택하기' },
] as const;

export const GAMES: readonly GameInfo[] = [
  {
    id: 'domino', category: 'strategy', icon: '🁢', kicker: '배치와 연쇄 물리', title: '도미노 한 방',
    description: '도미노 3개로 갈림길과 코너를 이어 가장 멀리 쓰러뜨리세요.', action: '게임 시작',
    players: '2~6명', time: '1인 약 40초', goal: '세 개의 도미노로 가장 많은 도미노를 쓰러뜨리세요.',
    controls: '30초 안에 12개 후보 중 번호를 눌러 배치하고 15°씩 회전하세요. 다른 후보를 누르면 이동합니다. 한 번 밀면 배치가 확정됩니다.',
    result: '60° 이상 기운 도미노 수가 많은 순, 같으면 배치 시간이 짧은 순입니다. 다른 사람은 배치와 결과를 보지 마세요.',
  },
  {
    id: 'ice', category: 'luck', icon: '🐧', kicker: '운과 연쇄 붕괴', title: '얼음깨기',
    description: '룰렛 색에 맞춰 얼음을 깨고 펭귄을 지키세요.', action: '게임 시작',
    players: '2~6명', time: '약 1분', goal: '내 차례에 펭귄을 떨어뜨리지 마세요.',
    controls: '룰렛을 돌린 뒤 나온 색의 육각 얼음을 눌러 깨세요.', result: '펭귄을 떨어뜨린 사람이 꼴찌입니다.',
  },
  {
    id: 'marbles', category: 'luck', icon: '🔴', kicker: '선택과 낙하 물리', title: '구슬 타워',
    description: '막대를 빼고 떨어진 구슬을 가장 적게 모으세요.', action: '게임 시작',
    players: '2~6명', time: '약 1분', goal: '내 차례에 떨어지는 구슬을 최소화하세요.',
    controls: '타워를 돌려 살펴보고 원하는 막대를 눌러 빼세요.', result: '타워가 빌 때까지 받은 구슬이 가장 적은 사람이 이깁니다.',
  },
  {
    id: 'pegdrop', category: 'luck', icon: '🟠', kicker: '직접 만든 길과 튕김', title: '툭 떨어뜨려',
    description: '돌기를 놓고 구슬을 쏴 가장 높은 점수를 만드세요.', action: '게임 시작',
    players: '2~6명', time: '약 1분', goal: '구슬을 높은 점수 칸으로 보내세요.',
    controls: '차례대로 돌기를 배치한 뒤 발사대를 당겨 구슬을 쏘세요.', result: '모든 구슬을 쏜 뒤 합계 점수가 가장 높은 사람이 이깁니다.',
  },
  {
    id: 'lottery', category: 'luck', icon: '🎫', kicker: '선택과 짜릿한 공개', title: '긁어봐!',
    description: '스크래치 복권을 직접 긁고 오늘 커피나 밥을 살 사람을 정하세요.', action: '게임 시작',
    players: '2~6명', time: '1분 이내', goal: '여러 장 중 내 운명의 복권을 고르세요.',
    controls: '한 장을 고른 뒤 손가락으로 은박을 여러 번 긁어 공개하세요.', result: '꽝이 나온 사람이 오늘의 계산 담당입니다.',
  },
  {
    id: 'bomb', category: 'luck', icon: '💣', artClass: 'bomb-card-art', kicker: 'UP·DOWN과 범위 압박', title: '숫자 폭탄',
    description: '범위를 좁혀가며 숨은 숫자를 피하고 다음 사람에게 넘기세요.', action: '폭탄 숨기기',
    players: '2~6명', time: '약 1분', goal: '숨겨진 폭탄 숫자를 끝까지 피하세요.',
    controls: '남은 범위 안에서 숫자 하나를 누르면 UP·DOWN 단서가 나옵니다.', result: '폭탄 숫자를 정확히 누른 사람이 꼴찌입니다.',
  },
  {
    id: 'balloon', category: 'luck', icon: '🎈', artClass: 'balloon-card-art', kicker: '배짱과 위험 넘기기', title: '터질까 말까',
    description: '풍선을 길게 부풀려 다음 사람에게 아슬아슬하게 넘기세요.', action: '풍선 하나',
    players: '2~6명', time: '1분 이내', goal: '풍선이 터지기 전에 손을 떼고 다음 사람에게 넘기세요.',
    controls: '풍선을 누르고 있는 동안 바람이 들어가며, 손을 떼면 차례가 끝납니다.', result: '풍선을 터뜨린 사람이 꼴찌입니다.',
  },
  {
    id: 'timing', category: 'skill', icon: '⏱️', kicker: '감각과 순간 판단', title: '멈춰!',
    description: '시간을 숨기거나 보면서 목표 초에 가장 가깝게 멈추세요.', action: '2가지 방식',
    players: '2~6명', time: '약 1분', goal: '목표 시간에 가장 가깝게 멈추세요.',
    controls: '시작을 누르고 감으로 기다린 뒤 다시 눌러 시간을 멈추세요.', result: '목표와의 오차가 가장 작은 사람이 이깁니다.',
  },
  {
    id: 'dart', category: 'skill', icon: '➤', artClass: 'dart-card-art', kicker: '회전과 빈틈 타이밍', title: '빙글 꽂아라',
    description: '움직이는 회전판의 빈틈을 읽고 다트를 최대한 많이 꽂으세요.', action: '3발 × 3라운드',
    players: '2~6명', time: '약 1분', goal: '회전판의 빈틈에 다트를 많이 꽂으세요.',
    controls: '회전하는 판을 보고 발사 버튼을 눌러 정해진 위치에서 쏘세요.', result: '기존 다트와 부딪히면 실패하며, 총점이 가장 높은 사람이 이깁니다.',
  },
  {
    id: 'dodge', category: 'skill', icon: '', artClass: 'dodge-card-art', kicker: '손끝 반응과 생존 본능', title: '말랑말랑 대탈출',
    description: '귀여운 동물을 누른 채 움직여 몰려오는 장난감을 피하세요.', action: '동물 뽑기',
    players: '2~6명', time: '약 1분', goal: '장애물에 닿지 않고 최대한 오래 버티세요.',
    controls: '동물을 손가락으로 누른 채 화면 안에서 자유롭게 움직이세요.', result: '생존 시간이 가장 긴 사람이 이깁니다.',
  },
  {
    id: 'lander', category: 'skill', icon: '🚀', artClass: 'lander-card-art', kicker: '추력과 착륙 감각', title: '아슬아슬 착륙',
    description: '누르고 밀어 우주선을 조종하고 가장 부드럽게 착륙하세요.', action: '엔진 점화',
    players: '2~6명', time: '약 1분', goal: '연료를 아끼며 착륙장에 부드럽게 내려오세요.',
    controls: '우주선을 누르고 밀어 추력의 방향과 세기를 조절하세요.', result: '착륙 정확도와 충격 점수를 합쳐 가장 높은 사람이 이깁니다.',
  },
  {
    id: 'parking', category: 'skill', icon: '🚙', artClass: 'parking-card-art', kicker: '조향과 제동 감각', title: '한 번에 주차',
    description: '차를 한 번 출발시켜 빈 주차칸에 정확히 멈추세요.', action: '주차 도전',
    players: '2~6명', time: '약 1분', goal: '한 번의 주행으로 주차칸 중앙에 차를 세우세요.',
    controls: '차를 눌러 방향과 힘을 정하고, 달리는 동안 눌러 제동하세요.', result: '주차 위치와 각도가 가장 정확한 사람이 이깁니다.',
  },
  {
    id: 'measure', category: 'eye', icon: '🫗', artClass: 'measure-card-art', kicker: '기억과 물 조절 감각', title: '눈금 없이 따라라',
    description: '목표 수위를 기억하고 남은 물줄기까지 계산해 한 번에 따르세요.', action: '물 따르기',
    players: '2~6명', time: '약 1분', goal: '사라진 목표 눈금에 맞춰 물을 따르세요.',
    controls: '목표 수위를 기억한 뒤 주전자를 누르고 기울여 한 번에 따르세요.', result: '물이 멈춘 뒤 목표 수위와의 오차가 가장 작은 사람이 이깁니다.',
  },
  {
    id: 'circle', category: 'eye', icon: '∿', artClass: 'circle-card-art', kicker: '다섯 곡선과 손끝 감각', title: '완벽한 곡선',
    description: '오늘의 곡선을 기억해 한 번에 그리고 가장 닮은 한 붓에 도전하세요.', action: '곡선 뽑기',
    players: '2~6명', time: '약 1분', goal: '잠깐 본 곡선을 한 붓으로 최대한 비슷하게 그리세요.',
    controls: '빈 캔버스를 손가락으로 누른 채 끝까지 한 번에 그리세요.', result: '모양과 비율의 유사도 점수가 가장 높은 사람이 이깁니다.',
  },
  {
    id: 'slice', category: 'eye', icon: '🍠', artClass: 'slice-card-art', kicker: '눈대중과 면적 감각', title: '반으로 쓱',
    description: '비대칭 물체를 한 줄로 잘라 정확한 50:50을 만드세요.', action: '반 나누기',
    players: '2~6명', time: '약 1분', goal: '울퉁불퉁한 물체의 부피를 정확히 반으로 나누세요.',
    controls: '3D 물체를 살펴본 뒤 손가락으로 절단선 하나를 그으세요.', result: '두 조각의 부피 차이가 가장 작은 사람이 이깁니다.',
  },
  {
    id: 'center', category: 'eye', icon: '＋', artClass: 'center-card-art', kicker: '부피 판단과 무게중심 감각', title: '중심을 찍어라',
    description: '한쪽이 더 두껍고 큰 3D 물체를 돌려 살펴보고 무게중심을 찍으세요.', action: '한 점 승부',
    players: '2~6명', time: '약 1분', goal: '비대칭 3D 물체의 진짜 무게중심을 찾으세요.',
    controls: '좌우·상하 회전 버튼으로 살펴본 뒤 물체를 눌러 한 점을 고르세요.', result: '정답 무게중심과의 거리가 가장 가까운 사람이 이깁니다.',
  },
  {
    id: 'shadow', category: 'eye', icon: '◆', artClass: 'shadow-card-art', kicker: '입체 회전과 공간 감각', title: '그림자 도둑',
    description: '3D 조형물을 돌려 검은 목표 그림자와 가장 정확히 겹치세요.', action: '그림자 훔치기',
    players: '2~6명', time: '약 1분', goal: '조형물의 그림자를 목표 실루엣과 겹치세요.',
    controls: '조형물을 손가락으로 밀어 3D 방향을 바꾸고 제출하세요.', result: '겹친 면적의 비율이 가장 높은 사람이 이깁니다.',
  },
  {
    id: 'cups', category: 'eye', icon: '', artClass: 'cup-card-art', kicker: '눈썰미와 집중력', title: '컵 속 구슬',
    description: '구슬을 숨긴 컵을 끝까지 따라가 가장 빠르게 찾아내세요.', action: '컵 따라가기',
    players: '2~6명', time: '약 1분', goal: '셔플이 끝날 때까지 구슬 든 컵을 놓치지 마세요.',
    controls: '컵의 움직임을 눈으로 따라간 뒤 정답이라고 생각한 컵을 누르세요.', result: '3라운드 합계 점수가 가장 높은 사람이 이깁니다.',
  },
  {
    id: 'tray', category: 'strategy', icon: '☕', artClass: 'tray-card-art', kicker: '균형과 배치 감각', title: '아슬아슬 트레이',
    description: '카페 물건을 번갈아 쌓고, 하나라도 떨어뜨리면 바로 패배!', action: '균형 잡기',
    players: '2~6명', time: '약 1분', goal: '시소 위에 물건을 올리되 바깥으로 떨어뜨리지 마세요.',
    controls: '끌어서 좌우 이동, 짧게 눌러 회전, 아래로 밀어 떨어뜨리세요.', result: '물건을 시소 바깥으로 떨어뜨린 사람이 꼴찌입니다.',
  },
  {
    id: 'path', category: 'strategy', icon: '↱', artClass: 'path-card-art', kicker: '경로 판단과 실시간 회전', title: '길을 바꿔라',
    description: '화살표를 돌려 경비원을 피하고 도둑의 탈출로를 완성하세요.', action: '탈출 작전',
    players: '2~6명', time: '약 1분', goal: '도둑이 움직이는 동안 출구까지 안전한 길을 만드세요.',
    controls: '방향 타일을 눌러 회전시키고 도둑의 다음 경로를 바꾸세요.', result: '탈출 성공, 남은 시간, 회전 횟수로 계산한 점수가 높은 사람이 이깁니다.',
  },
  {
    id: 'lunch', category: 'strategy', icon: '🍱', artClass: 'lunch-card-art', kicker: '공간 판단과 손끝 포장', title: '도시락 빈틈없이',
    description: '음식을 돌려 담고 가장 빈틈없는 도시락을 완성하세요.', action: '도시락 싸기',
    players: '2~6명', time: '약 1분', goal: '랜덤 도시락 칸을 음식으로 빈틈없이 채우세요.',
    controls: '음식을 끌어 옮기고 눌러 회전하며, 놓은 뒤에도 다시 배치할 수 있습니다.', result: '도시락 전체 면적 대비 채운 면적이 가장 넓은 사람이 이깁니다.',
  },
  {
    id: 'pop', category: 'strategy', icon: '🧩', kicker: '세 번의 선택과 연쇄 배치', title: '딱 세 번만 터뜨려',
    description: '블록이 떨어질 자리까지 읽고 세 번의 선택으로 크게 터뜨리세요.', action: '세 수 승부',
    players: '2~6명', time: '1인 25초', goal: '딱 세 번으로 최대한 많은 블록을 없애세요.',
    controls: '같은 색이 2개 이상 붙은 덩어리를 눌러 확인하고 한 번 더 눌러 터뜨리세요.', result: '없앤 블록 수가 많은 순서로, 동점이면 짧은 시간 순으로 순위를 정합니다.',
  },
  {
    id: 'untangle', category: 'strategy', icon: '🪢', kicker: '공간 판단과 엉킨 선', title: '엉킨 선 풀어라',
    description: '8개의 점을 안팎으로 옮겨 14개의 엉킨 선을 풀어보세요.', action: '선 풀기',
    players: '2~6명', time: '1인 25초', goal: '선이 서로 교차하지 않게 모든 매듭을 푸세요.',
    controls: '동그란 점을 손가락으로 끌어 옮기세요. 서로 닿거나 겹친 선도 풀어야 합니다.', result: '남은 교차 수가 적을수록 높은 순위. 모두 풀었다면 완료 시간을 비교합니다.',
  },
  {
    id: 'cat', category: 'strategy', icon: '🐈', kicker: '상자 밀기와 탈출 경로', title: '고양이 꺼내줘',
    description: '상자를 밀어 길을 만들고 두 방에 갇힌 고양이를 구출하세요.', action: '고양이 구출',
    players: '2~6명', time: '1인 25초', goal: '고양이를 오른쪽 출구까지 밀어 두 마리를 구출하세요.',
    controls: '상자는 화살표 방향으로만 밀 수 있어요. 한 번 밀어 놓을 때마다 1수입니다.', result: '구출 수, 구출에 쓴 이동 수, 구출 시간 순서로 비교합니다. 같은 기록은 공동 순위입니다.',
  },
];

export function pickRandomGame(previousId?: GameId, random = Math.random): GameInfo {
  const pool = previousId && GAMES.length > 1 ? GAMES.filter((game) => game.id !== previousId) : GAMES;
  const value = Math.min(0.999999, Math.max(0, random()));
  return pool[Math.floor(value * pool.length)];
}
