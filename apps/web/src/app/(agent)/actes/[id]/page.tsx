import { FicheActe } from '@/features/parapheur/view/FicheActe';

// D2–D8 · /actes/[id]
export default async function FichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheActe id={id} />;
}
