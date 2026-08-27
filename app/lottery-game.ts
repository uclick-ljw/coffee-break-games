export type LotteryTicket = { id: number; penalty: boolean };

function secureIndex(max: number) {
  const ceiling = 0x100000000 - (0x100000000 % max);
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= ceiling);
  return value[0] % max;
}

export function makeLotteryTickets(
  people: number,
  penalties: number,
  pickIndex: (max: number) => number = secureIndex,
) {
  if (!Number.isInteger(people) || people < 2 || !Number.isInteger(penalties) || penalties < 1 || penalties > people) {
    throw new RangeError('참가자는 2명 이상, 꽝은 참가자 수 이하여야 합니다.');
  }
  const tickets = Array.from({ length: people }, (_, id) => ({ id, penalty: id < penalties }));
  for (let index = tickets.length - 1; index > 0; index -= 1) {
    const swap = pickIndex(index + 1);
    if (!Number.isInteger(swap) || swap < 0 || swap > index) throw new RangeError('잘못된 무작위 인덱스입니다.');
    [tickets[index], tickets[swap]] = [tickets[swap], tickets[index]];
  }
  return tickets;
}
