import { Editeur } from '@/features/actes/view/Editeur';

// Éditeur d'acte (BF-17, BF-18).
export default async function EditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editeur id={id} />;
}
