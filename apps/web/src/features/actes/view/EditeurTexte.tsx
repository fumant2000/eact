'use client';

// Éditeur de texte riche (BF-17) avec TipTap ; produit le HTML restreint accepté par le serveur.
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, Plus, Underline, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';

/** « Article 1er. », « Article 2. »… numéroté d'après les articles déjà présents. */
function ajouterArticle(editor: Editor) {
  const n = (editor.getText().match(/Article\s+(1er|\d+)\s*\./g) ?? []).length + 1;
  editor
    .chain()
    .focus('end')
    .insertContent(`<p><strong>Article ${n === 1 ? '1er' : n}.</strong> </p>`)
    .run();
}

function Outil({ actif, libelle, onClick, children }: { actif?: boolean; libelle: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      aria-pressed={actif}
      onMouseDown={(e) => e.preventDefault()} // garde la sélection dans l'éditeur
      onClick={onClick}
      className={`grid size-10 place-items-center rounded-md ${actif ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent'}`}
    >
      {children}
    </button>
  );
}

export function BarreOutils({ editor }: { editor: Editor }) {
  const { t } = useT();
  const etat = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      gras: e.isActive('bold'),
      italique: e.isActive('italic'),
      souligne: e.isActive('underline'),
      liste: e.isActive('bulletList'),
      intertitre: e.isActive('heading', { level: 2 }),
      peutAnnuler: e.can().undo(),
    }),
  });
  return (
    <div role="toolbar" aria-label={t('editeur.texte')} className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-2">
      <select
        aria-label={t('editeur.paragraphe')}
        value={etat.intertitre ? 'h2' : 'p'}
        onChange={(e) =>
          e.target.value === 'h2' ? editor.chain().focus().setHeading({ level: 2 }).run() : editor.chain().focus().setParagraph().run()
        }
        className="h-10 rounded-md border border-input bg-card px-2 text-sm"
      >
        <option value="p">{t('editeur.paragraphe')}</option>
        <option value="h2">{t('editeur.intertitre')}</option>
      </select>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      <Outil libelle={t('editeur.gras')} actif={etat.gras} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={18} /></Outil>
      <Outil libelle={t('editeur.italique')} actif={etat.italique} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={18} /></Outil>
      <Outil libelle={t('editeur.souligne')} actif={etat.souligne} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={18} /></Outil>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      <Outil libelle={t('editeur.liste')} actif={etat.liste} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={18} /></Outil>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => ajouterArticle(editor)}
        className="flex h-10 items-center gap-1 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-primary-100"
      >
        <Plus size={16} aria-hidden /> {t('editeur.article')}
      </button>
      <span className="ml-auto" />
      <Outil libelle={t('editeur.annulerSaisie')} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={18} className={etat.peutAnnuler ? '' : 'opacity-40'} />
      </Outil>
    </div>
  );
}

/** Crée l'éditeur ; la vue place ensuite <BarreOutils> et <ZoneTexte>. */
export function useEditeurRiche(html: string, onChange: (html: string) => void, libelle: string) {
  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
        strike: false,
      }),
    ],
    content: html,
    immediatelyRender: false, // rendu serveur de Next : l'éditeur ne s'initialise que dans le navigateur
    editorProps: {
      attributes: { id: 'champ-contenu', class: 'corps-acte font-serif min-h-48', 'aria-label': libelle },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
}

export function ZoneTexte({ editor, invalide }: { editor: Editor | null; invalide?: boolean }) {
  if (!editor) return <div className="min-h-48" aria-hidden />;
  return <EditorContent editor={editor} className={invalide ? 'rounded-md ring-2 ring-destructive ring-offset-4' : ''} />;
}
