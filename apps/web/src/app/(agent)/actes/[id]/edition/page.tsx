import { Editeur } from '@/features/actes/view/Editeur';

// C4–C10 · /actes/[id]/edition
export default async function EditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editeur id={id} />;
}
