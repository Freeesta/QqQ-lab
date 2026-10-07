"use strict";
// Neutral losses (window «Perdite neutre», tables.js): the list and the search for combinations. Pure data and functions, also run by node in tests/test_perdite.py.
// The exact masses are NOT written here: tables.js computes them from the formulas with the element data (elements.js), the test with qqq_lab/chem/elements.py.
// Sources (primary literature): Levsen et al., J. Mass Spectrom. 42 (2007) 1024-1044; Holcapek, Jirasko, Lisa, J. Chromatogr. A 1217 (2010) 3908-3921;
// Demarque et al., Nat. Prod. Rep. 33 (2016) 432-455; De Vijlder et al., Mass Spectrom. Rev. 37 (2018) 607-629. The column «si vede in» and the mechanisms are
// textbook summaries of what those reviews describe; no percentages (none was checked against the full texts). Peptide / lipid specific losses are left out on purpose.
// f = neutral formula (mass computed), pol = typical ionisation polarity ("+", "-" or "±"), rad = the lost species is a radical (odd-electron loss)
const LOSSES = [
  { f: "CH3", name: "radicale metile", rad: true, pol: "±", seen: "metossi (Ar–OCH3), gruppi N-metil e S-metil", mech: "Scissione omolitica di un legame: se ne va un radicale metile e lo ione che resta ha un elettrone spaiato (ione a elettroni dispari)." },
  { f: "NH3", name: "ammoniaca", pol: "+", seen: "ammine e ammidi primarie, addotti [M+NH4]+", mech: "Eliminazione di ammoniaca da un'ammina o un'ammide protonata; dall'addotto [M+NH4]+ riporta a [M+H]+." },
  { f: "H2O", name: "acqua", pol: "±", seen: "alcoli, fenoli, acidi carbossilici, aldeidi", mech: "Eliminazione di acqua da un gruppo OH (protonato negli ioni positivi) con un idrogeno vicino. Molto comune e poco specifica." },
  { f: "HF", name: "acido fluoridrico", pol: "±", seen: "composti fluorurati (Ar–F, CF3)", mech: "Eliminazione di HF, di solito da un fluoro con un idrogeno vicino." },
  { f: "HCN", name: "acido cianidrico", pol: "+", seen: "nitrili, eterocicli azotati (piridina, imidazolo)", mech: "Rottura di un nitrile o di un anello azotato con perdita di acido cianidrico." },
  { f: "CO", name: "monossido di carbonio", pol: "±", seen: "fenoli, chinoni, chetoni, aldeidi, lattoni", mech: "Perdita di CO da un carbonile, spesso con contrazione dell'anello; di solito segue un'altra perdita." },
  { f: "C2H4", name: "etilene", pol: "+", seen: "gruppi etilici (N-etil, O-etil), esteri etilici", mech: "Perdita di etilene da un gruppo etilico con trasferimento di un idrogeno." },
  { f: "CH2O", name: "formaldeide", pol: "+", seen: "metossi (Ar–OCH3), alcoli, esteri metilici", mech: "Perdita di formaldeide da un metossi o da un alcool, con trasferimento di idrogeno." },
  { f: "CH4O", name: "metanolo", pol: "±", seen: "esteri metilici, metossi vicino a un idrogeno acido", mech: "Perdita di metanolo da un estere metilico o da un metossi con un idrogeno mobile vicino." },
  { f: "H2S", name: "solfuro di idrogeno (acido solfidrico)", pol: "±", seen: "tioli, tioeteri", mech: "Eliminazione di H2S da un tiolo o da un tioetere con un idrogeno vicino." },
  { f: "HCl", name: "acido cloridrico", pol: "±", seen: "composti clorurati (alchilici e aromatici)", mech: "Eliminazione di HCl da un cloruro con un idrogeno vicino. Il cloro ha due isotopi (35Cl e 37Cl): guarda anche M+2." },
  { f: "Cl", name: "radicale cloro", rad: true, pol: "±", seen: "composti con cloro legato a un anello aromatico (es. pesticidi clorurati)", mech: "Perdita del solo atomo di cloro come radicale (•Cl, Δm 35; 37 se il precursore contiene 37Cl): lo ione che resta è a elettroni dispari. •Cl (35): perdita del solo atomo, rara (radicale); HCl (36): perdita della molecola, più comune." },
  { f: "C2H2O", name: "chetene", pol: "±", seen: "acetammidi, acetati (gruppi acetile)", mech: "Perdita di chetene (CH2=C=O) da un gruppo acetile, per esempio da un'acetammide o da un acetato aromatico." },
  { f: "C3H6", name: "propene", pol: "+", seen: "gruppi isopropilici e propilici", mech: "Perdita di propene da un gruppo isopropile o propile con trasferimento di idrogeno." },
  { f: "CO2", name: "anidride carbonica", pol: "±", seen: "acidi carbossilici, carbammati, lattoni", mech: "Decarbossilazione: dai carbossilati (ioni negativi) è molto frequente; avviene anche da carbammati e lattoni." },
  { f: "CH2O2", name: "acido formico", pol: "±", seen: "acidi e esteri formici, addotti [M+HCOO]-", mech: "Perdita di acido formico; dall'addotto con formiato [M+HCOO]- riporta allo ione [M-H]-." },
  { f: "NO2", name: "radicale NO2", rad: true, pol: "-", seen: "nitroderivati (nitroaromatici)", mech: "Perdita di un radicale NO2 da un gruppo nitro: lo ione che resta è a elettroni dispari." },
  { f: "C4H8", name: "butene", pol: "+", seen: "gruppi butile e ter-butile", mech: "Perdita di butene (isobutene dal ter-butile) con trasferimento di idrogeno." },
  { f: "C2H3NO", name: "metil isocianato", pol: "+", seen: "N-metilcarbammati", mech: "Rottura del carbammato con perdita di CH3–N=C=O (metil isocianato)." },
  { f: "SO2", name: "anidride solforosa", pol: "±", seen: "solfoni, sulfonammidi, sulfonati", mech: "Perdita di SO2 da un gruppo solfonico, spesso con un riarrangiamento." },
  { f: "C6H6", name: "benzene", pol: "+", seen: "un fenile legato a un eteroatomo o a un carbonio benzilico", mech: "Perdita di benzene da un fenile, con trasferimento di idrogeno." },
  { f: "HBr", name: "acido bromidrico", pol: "±", seen: "composti bromurati", mech: "Eliminazione di HBr da un bromuro con un idrogeno vicino. Il bromo ha due isotopi quasi uguali (79Br e 81Br): guarda M+2." },
  { f: "SO3", name: "triossido di zolfo", pol: "-", seen: "solfati e sulfonati (coniugati con il solfato)", mech: "Perdita di SO3 da un solfato o da un sulfonato; è tipica degli ioni negativi." },
];
const LOSS_REFS = "Levsen 2007; Holčapek 2010";
const LOSS_RAD = "perdita di un radicale: rara in ESI (eccezione alla regola degli elettroni pari), di solito anelli aromatici o gruppi nitro";
// the candidates for a mass difference: single losses within the tolerance, pairs that add up to it, and repetitions (n x the same loss).
// mass(f) = exact mass of a formula (given by the caller); tol in Da.
function lossCombos(target, mass, tol = 0.5, list = LOSSES) {
  const m = list.map(l => ({ l, m: mass(l.f) }));
  const single = m.filter(x => Math.abs(x.m - target) <= tol).map(x => [x.l]);
  const pairs = [], reps = [];
  for (let i = 0; i < m.length; i++) {
    for (let j = i + 1; j < m.length; j++) if (Math.abs(m[i].m + m[j].m - target) <= tol) pairs.push([m[i].l, m[j].l]);
    for (let n = 2; n <= 4; n++) if (Math.abs(n * m[i].m - target) <= tol) reps.push({ n, l: m[i].l });
  }
  return { single, pairs, reps };
}
if (typeof module !== "undefined") module.exports = { LOSSES, LOSS_REFS, LOSS_RAD, lossCombos };
