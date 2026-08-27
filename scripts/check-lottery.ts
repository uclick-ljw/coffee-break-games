import assert from 'node:assert/strict';
import { makeLotteryTickets } from '../app/lottery-game.ts';

let seed = 3;
const tickets = makeLotteryTickets(12, 4, (max) => (seed = (seed * 7 + 5) % max));
assert.equal(tickets.length, 12);
assert.equal(tickets.filter((ticket) => ticket.penalty).length, 4);
assert.equal(new Set(tickets.map((ticket) => ticket.id)).size, 12);
assert.equal(makeLotteryTickets(4, 4).filter((ticket) => ticket.penalty).length, 4);
assert.throws(() => makeLotteryTickets(4, 5));
assert.throws(() => makeLotteryTickets(1, 0));
console.log('lottery checks passed');
