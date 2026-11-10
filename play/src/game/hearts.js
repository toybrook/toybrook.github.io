// Temporary heart rule, kept on its own so 19단계 ("특별 행동") can swap it out:
// tapping an animal gives BALANCE.heart.perTap, at most once per cooldown for the same animal,
// and at most BALANCE.heart.daily a day in all (S.pet = { day, n }; the device's local day, so it refills at local midnight).
import { BALANCE } from './data.js';
import { dayOf } from './clock.js';

export function heartFor(S, animal, now) {
  if (now - (animal.heartAt || 0) < BALANCE.heart.cooldown) return 0;
  animal.heartAt = now;
  const day = dayOf(now); if (S.pet?.day !== day) S.pet = { day, n: 0 };
  const n = Math.min(BALANCE.heart.perTap, BALANCE.heart.daily - S.pet.n);
  S.pet.n += n; return n;
}
