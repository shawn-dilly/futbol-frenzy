import type { CupSession } from './cupSession';

export function resultScreen(status: CupSession['status'] | null) {
  switch (status) {
    case 'active': return { title: 'ROUND WON', action: 'NEXT ROUND' };
    case 'ended': return { title: 'CUP ELIMINATION', action: 'RETRY' };
    case 'completed': return { title: 'CUP CHAMPIONS', action: null };
    case 'quit': return { title: 'FULL TIME', action: null };
    default: return { title: 'FULL TIME', action: 'NEW MATCH' };
  }
}
