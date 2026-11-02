import { FicheActe } from '@/features/parapheur/view/FicheActe';

// Fiche d'un acte (BF-24 à BF-26, BF-28).
export default async function FichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheActe id={id} />;
}
