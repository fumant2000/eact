import { calculerHash, jsonCanonique } from './audit.service';

describe('Journal chaîné (BF-49)', () => {
  const horodatage = new Date('2026-11-02T08:00:00.000Z');
  const precedent = '0'.repeat(64);

  it("l'empreinte ne dépend pas de l'ordre des clés (jsonb les réordonne)", () => {
    const ecrit = { action: 'piece.analysee', ressourceType: 'piece', details: { statut: 'INFECTEE', motif: 'EICAR', n: { b: 1, a: 2 } } };
    const relu = { action: 'piece.analysee', ressourceType: 'piece', details: { motif: 'EICAR', n: { a: 2, b: 1 }, statut: 'INFECTEE' } };
    expect(calculerHash(precedent, ecrit, horodatage)).toBe(calculerHash(precedent, relu, horodatage));
  });

  it('toute modification du contenu change l’empreinte (TF-13)', () => {
    const e = { action: 'acte.signe', ressourceType: 'acte', ressourceId: 'x', details: { reference: 'N° 26/0001/NS/MINESUP/SG/DAG' } };
    const falsifie = { ...e, details: { reference: 'N° 26/0002/NS/MINESUP/SG/DAG' } };
    expect(calculerHash(precedent, e, horodatage)).not.toBe(calculerHash(precedent, falsifie, horodatage));
  });

  it('chaque entrée dépend de la précédente', () => {
    const e = { action: 'acte.cree', ressourceType: 'acte' };
    expect(calculerHash(precedent, e, horodatage)).not.toBe(calculerHash('f'.repeat(64), e, horodatage));
  });

  it('JSON canonique : tableaux conservés dans leur ordre', () => {
    expect(jsonCanonique({ b: [3, 1], a: null })).toBe('{"a":null,"b":[3,1]}');
  });
});
