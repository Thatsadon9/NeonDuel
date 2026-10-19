/** Minion factory (Act I + ASCENSION minions). */
import { Rusher, Gunner, Shielder, Bomber, type Enemy } from './enemies';
import { Swarmling, Wraith, Lancer, Acolyte, Sentry, Broodmother, Brute, MirrorShard } from './enemies2';

export type MinionKind = 'rusher' | 'gunner' | 'shield' | 'bomber' | 'swarmling' | 'wraith' | 'lancer' | 'acolyte' | 'sentry' | 'broodmother' | 'brute' | 'mirror_shard';

export function makeMinion(k: MinionKind, x: number, y: number): Enemy {
  switch (k) {
    case 'rusher': return new Rusher(x, y);
    case 'gunner': return new Gunner(x, y);
    case 'shield': return new Shielder(x, y);
    case 'bomber': return new Bomber(x, y);
    case 'swarmling': return new Swarmling(x, y);
    case 'wraith': return new Wraith(x, y);
    case 'lancer': return new Lancer(x, y);
    case 'acolyte': return new Acolyte(x, y);
    case 'sentry': return new Sentry(x, y);
    case 'broodmother': return new Broodmother(x, y);
    case 'brute': return new Brute(x, y);
    case 'mirror_shard': return new MirrorShard(x, y);
  }
}
/** id used by the codex lore / sprites for a minion kind */
export const MINION_KEY: Record<MinionKind, string> = {
  rusher: 'rusher', gunner: 'gunner', shield: 'bulwark', bomber: 'bomber', swarmling: 'swarmling', wraith: 'wraith', lancer: 'lancer',
  acolyte: 'acolyte', sentry: 'sentry', broodmother: 'broodmother', brute: 'brute', mirror_shard: 'mirror_shard',
};
