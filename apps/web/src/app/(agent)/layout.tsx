import type { ReactNode } from 'react';
import { Coque } from '@/components/coque/Coque';

/** Espace agent : toute page ici exige une session (redirection vers /connexion sinon). */
export default function EspaceAgent({ children }: { children: ReactNode }) {
  return <Coque>{children}</Coque>;
}
