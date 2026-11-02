'use client';

// Coque de l'espace agent (composants AppHeader, AppSidebar, MobileTopBar de la maquette ; A1 tiroir mobile).
import {
  Archive,
  Bug,
  ChevronDown,
  Files,
  Home,
  Inbox,
  LogOut,
  Menu,
  FileCode2,
  Network,
  Workflow,
  PenTool,
  Plus,
  ScrollText,
  Search,
  UserCog,
  X,
  type LucideIcon,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { SelecteurLangue } from '@/components/SelecteurLangue';
import { Button, classesBouton } from '@/components/ui/primitives';
import { DialogueChangerCompte, useModeDemo } from '@/features/auth/view/Demo';
import { useSession } from '@/features/auth/view-model/useSession';
import { parapheurApi } from '@/features/parapheur/model/parapheur.api';
import { signatureApi } from '@/features/signature/model/signature.api';
import { useT, type CleTraduction } from '@/i18n';

interface EntreeMenu {
  href: string;
  cle: CleTraduction;
  icone: LucideIcon;
  roles?: string[]; // absent = tout utilisateur interne
  bientot?: boolean; // hors P0 : entrée grisée (brief design)
  compteur?: 'parapheur' | 'signature';
}

const SECTIONS: { cle: CleTraduction; entrees: EntreeMenu[] }[] = [
  {
    cle: 'menu.travail',
    entrees: [
      { href: '/mon-travail', cle: 'menu.monTravail', icone: Home },
      { href: '/parapheur', cle: 'menu.parapheur', icone: Inbox, roles: ['VISEUR', 'JURISTE', 'TRADUCTEUR', 'SECRETAIRE_GENERAL'], compteur: 'parapheur' },
      { href: '/signature', cle: 'menu.signature', icone: PenTool, roles: ['AUTORITE_SIGNATAIRE', 'DELEGATAIRE_SIGNATURE'], compteur: 'signature' },
      { href: '/mes-actes', cle: 'menu.mesActes', icone: Files, roles: ['REDACTEUR'] },
      { href: '/delegations', cle: 'menu.delegations', icone: UserCog, roles: ['AUTORITE_SIGNATAIRE', 'SECRETAIRE_GENERAL', 'VISEUR', 'JURISTE', 'TRADUCTEUR', 'DELEGATAIRE_SIGNATURE'] },
    ],
  },
  {
    cle: 'menu.consultation',
    entrees: [
      { href: '/recherche', cle: 'menu.recherche', icone: Search, bientot: true },
      { href: '/archives', cle: 'menu.archives', icone: Archive, bientot: true },
      { href: '/audit', cle: 'menu.audit', icone: ScrollText, roles: ['AUDITEUR', 'ADMINISTRATEUR'] },
    ],
  },
  {
    cle: 'menu.administration',
    // J1–J8 (organigramme, utilisateurs, types, circuits, gabarits) : itération suivante.
    entrees: [
      { href: '/admin/utilisateurs', cle: 'admin.utilisateurs', icone: Network, roles: ['ADMINISTRATEUR'] },
      { href: '/admin/circuits', cle: 'admin.circuits', icone: Workflow, roles: ['ADMINISTRATEUR'] },
      { href: '/admin/gabarits', cle: 'admin.gabarits', icone: FileCode2, roles: ['ADMINISTRATEUR'] },
    ],
  },
];

const ROLES_VISEURS = ['VISEUR', 'JURISTE', 'TRADUCTEUR', 'SECRETAIRE_GENERAL'];

function BarreLaterale({ roles, onNaviguer }: { roles: string[]; onNaviguer?: () => void }) {
  const { t } = useT();
  const chemin = usePathname();
  const parapheur = useQuery({
    queryKey: ['parapheur'],
    queryFn: parapheurApi.lister,
    enabled: roles.some((r) => ROLES_VISEURS.includes(r)),
    refetchInterval: 60_000,
  });
  const aSigner = useQuery({
    queryKey: ['a-signer'],
    queryFn: signatureApi.aSigner,
    enabled: roles.some((r) => r === 'AUTORITE_SIGNATAIRE' || r === 'DELEGATAIRE_SIGNATURE'),
    refetchInterval: 60_000,
  });
  const compteurs = { parapheur: parapheur.data?.aViser.length ?? 0, signature: aSigner.data?.length ?? 0 };
  return (
    <nav className="flex h-full flex-col gap-6 p-4" aria-label="Navigation principale">
      {roles.includes('REDACTEUR') && (
        <Link href="/actes/nouveau" onClick={onNaviguer} className={classesBouton({ size: 'lg', className: 'w-full' })}>
          <Plus size={18} aria-hidden /> {t('menu.nouvelActe')}
        </Link>
      )}
      {SECTIONS.map((s) => {
        const visibles = s.entrees.filter((e) => !e.roles || e.roles.some((r) => roles.includes(r)));
        if (!visibles.length) return null;
        return (
          <div key={s.cle}>
            <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t(s.cle)}</p>
            <ul className="space-y-1">
              {visibles.map((e) => {
                const actif = chemin === e.href || chemin.startsWith(`${e.href}/`);
                const contenu = (
                  <>
                    <e.icone size={18} aria-hidden />
                    <span className="flex-1">{t(e.cle)}</span>
                    {e.bientot && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t('menu.bientot')}</span>}
                    {e.compteur && compteurs[e.compteur] > 0 && (
                      <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{compteurs[e.compteur]}</span>
                    )}
                  </>
                );
                return (
                  <li key={e.href}>
                    {e.bientot ? (
                      <span aria-disabled className="flex items-center gap-3 rounded-md px-3 py-2.5 text-muted-foreground/70">{contenu}</span>
                    ) : (
                      <Link
                        href={e.href}
                        onClick={onNaviguer}
                        aria-current={actif ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${actif ? 'bg-accent font-semibold text-accent-foreground' : 'text-foreground hover:bg-accent'}`}
                      >
                        {contenu}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="mt-auto border-t border-border pt-4 text-sm">
        <span className="flex items-center gap-3 px-3 py-2 text-muted-foreground/70">
          <Bug size={18} aria-hidden /> {t('menu.anomalie')}
        </span>
        <p className="px-3 text-xs text-muted-foreground">Version 0.1.0</p>
      </div>
    </nav>
  );
}

function initiales(prenom: string, nom: string) {
  return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase();
}

export function Coque({ children }: { children: ReactNode }) {
  const { t } = useT();
  const session = useSession();
  const [tiroir, setTiroir] = useState(false);
  const [menuProfil, setMenuProfil] = useState(false);
  const [changerCompte, setChangerCompte] = useState(false);
  const demo = useModeDemo();
  const chemin = usePathname();
  useEffect(() => setTiroir(false), [chemin]);
  // Mode concentration : l'éditeur d'acte masque la barre latérale (guide d'implémentation §5, point 3).
  const concentration = /^\/actes\/[^/]+\/edition$/.test(chemin);

  if (!session.profil) {
    return <p className="grid min-h-screen place-items-center text-muted-foreground">{t('commun.chargement')}</p>;
  }
  const p = session.profil;
  // Un délégataire de signature en cours (BF-09) voit l'entrée « À signer » comme le titulaire.
  const rolesMenu = p.delegationsActives.length ? [...p.roles, 'DELEGATAIRE_SIGNATURE'] : p.roles;
  const reste = session.resteAvantFermeture;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-2">Aller au contenu</a>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-primary-800 px-4 text-white">
        <button className={`grid size-11 place-items-center rounded-md ${concentration ? '' : 'lg:hidden'}`} aria-label="Menu" aria-expanded={tiroir} onClick={() => setTiroir(true)}>
          <Menu size={22} />
        </button>
        <Link href="/mon-travail" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-white font-bold text-primary-800" aria-hidden>E</span>
          <span className="font-bold tracking-[0.12em]">EACT</span>
          <span className="hidden border-l border-white/30 pl-3 text-sm text-primary-200 sm:inline">MINESUP</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:block"><SelecteurLangue sombre /></span>
          <div className="relative">
            <button
              className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-white/10"
              aria-haspopup="menu"
              aria-expanded={menuProfil}
              onClick={() => setMenuProfil(!menuProfil)}
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary-500 text-sm font-semibold">{initiales(p.prenom, p.nom)}</span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block font-semibold">{p.prenom} {p.nom}</span>
                <span className="block text-sm text-primary-200">{t(`role.${p.roles[0]}` as CleTraduction)} · {p.structure.code}</span>
              </span>
              <ChevronDown size={16} aria-hidden />
            </button>
            {menuProfil && (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card p-1 text-foreground shadow-lg">
                <p className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.matricule}</p>
                {demo?.actif && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuProfil(false);
                      setChangerCompte(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent"
                  >
                    <Users size={16} aria-hidden /> {t('demo.changerCompte')}
                  </button>
                )}
                <button role="menuitem" onClick={session.deconnecter} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent">
                  <LogOut size={16} aria-hidden /> {t('menu.deconnexion')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <DialogueChangerCompte ouvert={changerCompte} onFermer={() => setChangerCompte(false)} actuel={p.matricule} />

      <div className="flex flex-1">
        <aside className={`sticky top-16 hidden h-[calc(100vh-4rem)] w-62 shrink-0 border-r border-border bg-card ${concentration ? '' : 'lg:block'}`}>
          <BarreLaterale roles={rolesMenu} />
        </aside>
        {tiroir && (
          <div className={`fixed inset-0 z-40 ${concentration ? '' : 'lg:hidden'}`} role="dialog" aria-modal aria-label="Menu">
            <button className="absolute inset-0 bg-black/40" aria-label="Fermer le menu" onClick={() => setTiroir(false)} />
            <aside className="relative h-full w-72 max-w-[85vw] bg-card">
              <button className="absolute top-3 right-3 grid size-11 place-items-center" aria-label="Fermer le menu" onClick={() => setTiroir(false)}>
                <X size={20} />
              </button>
              <div className="h-full pt-12"><BarreLaterale roles={rolesMenu} onNaviguer={() => setTiroir(false)} /></div>
            </aside>
          </div>
        )}
        <main id="contenu" className="mx-auto w-full max-w-[1280px] flex-1 p-4 md:p-8">{children}</main>
      </div>

      {reste !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="alertdialog" aria-modal aria-labelledby="titre-inactivite">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl">
            <h2 id="titre-inactivite" className="text-lg font-semibold">{t('inactivite.titre')}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('inactivite.texte', { t: `${Math.floor(reste / 60_000)}:${String(Math.floor((reste % 60_000) / 1000)).padStart(2, '0')}` })}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={session.deconnecter}>{t('menu.deconnexion')}</Button>
              <Button onClick={session.resterConnecte} autoFocus>{t('inactivite.rester')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

