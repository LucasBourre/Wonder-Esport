// Application des effets (« fx ») d'une issue d'événement.

import type { Dict } from "@open-eleven/content";
import { clamp, fmtMoney } from "./utils";
import { natForms } from "./country-names";
import { dualNatOf, altNatOf } from "./nationality";
import { tx } from "./text";
import { applyInjury } from "./injuries";
import { divShort, visibilityOf, shiftClubLevel } from "./clubs";
import { hasTrait } from "./player";
import type { CareerState, Chip, Fx } from "./types";
import { ARCHETYPES, AWARDS, COMPETITIONS, ROLES, TRAITS } from "@open-eleven/content";

// --- Application des effets ("fx") ---------------------------------------
export const STAT_LABELS: Dict<string> = { t: "Technique", p: "Physique", m: "Mental", c: "Charisme" };

export function applyFx(s: CareerState, fx: Fx) {
  const chips: Chip[] = [];
  if (!fx) return chips;

  for (const key of ["t", "p", "m", "c"] as const) {
    if (fx[key]) {
      let d = fx[key];
      if (d > 0 && key === "t" && hasTrait(s, "genius") && s.age <= 23) d = Math.round(d * 1.4);
      s.stats[key] = clamp(s.stats[key] + d, 1, 99);
      chips.push({ label: `${d > 0 ? "+" : ""}${d} ${STAT_LABELS[key]}`, kind: d > 0 ? "good" : "bad" });
    }
  }
  if (fx.rep) {
    let d = fx.rep;
    if (d > 0) d = Math.round(d * visibilityOf(s));
    if (d > 0 && hasTrait(s, "showman")) d = Math.round(d * 1.3);
    if (d > 0 && hasTrait(s, "mercenary")) d = Math.round(d * 0.85);
    s.rep = clamp(s.rep + d, 0, 100);
    if (d) chips.push({ label: tx(s, "chipRep", { sign: d > 0 ? "+" : "", n: d }), kind: d > 0 ? "good" : "bad" });
  }
  if (fx.form) {
    s.form = clamp(s.form + fx.form, 5, 100);
    chips.push({ label: `${fx.form > 0 ? "+" : ""}${fx.form} Forme`, kind: fx.form > 0 ? "good" : "bad" });
  }
  if (fx.mor) {
    s.moral = clamp(s.moral + fx.mor, 5, 100);
    chips.push({ label: `${fx.mor > 0 ? "+" : ""}${fx.mor} Moral`, kind: fx.mor > 0 ? "good" : "bad" });
  }
  if (fx.dis) {
    s.discipline = clamp(s.discipline + fx.dis, 5, 100);
    chips.push({ label: `${fx.dis > 0 ? "+" : ""}${fx.dis} Discipline`, kind: fx.dis > 0 ? "good" : "bad" });
  }
  if (fx.coach) {
    s.coachRel = clamp(s.coachRel + fx.coach, 5, 100);
    chips.push({ label: `${fx.coach > 0 ? "+" : ""}${fx.coach} Relation coach`, kind: fx.coach > 0 ? "good" : "bad" });
  }
  if (fx.team) {
    s.teamRel = clamp(s.teamRel + fx.team, 5, 100);
    chips.push({ label: `${fx.team > 0 ? "+" : ""}${fx.team} Vestiaire`, kind: fx.team > 0 ? "good" : "bad" });
  }
  // Bascule de sélection (double nationalité). Irréversible : une fois le choix
  // fait, l'autre fédération est écartée (s.dualNat vidé), comme dans la réalité
  // dès qu'on a joué un match officiel A.
  if (fx.natSwitch) {
    const target = dualNatOf(s);
    if (target) {
      const from = s.nationality;
      s.nationality = target;
      s.flags.natSwitched = true;
      s.natSwitchFrom = from.id;
      chips.push({ label: tx(s, "chipNatCall", { target: natForms(target).the }), kind: "trait" });
      s.history.push({ age: s.age, text: tx(s, "natSwitch", { target: natForms(target).the, from: natForms(from).the }), impact: 6 });
    }
    s.dualNat = null;
  }
  if (fx.natLock) { // on confirme la nation de naissance → l'autre porte se ferme
    // … mais pas à double tour : tant qu'aucun match officiel A n'est joué,
    // l'autre fédération peut revenir plus tard (cf. natSwitchAlt).
    s.dualNatAlt = s.dualNat || s.dualNatAlt || null;
    s.dualNat = null;
    s.flags.natLocked = true;
  }
  // Seconde chance : jamais appelé par sa sélection, le joueur rejoint l'autre
  // nation à laquelle il était éligible (mémorisée dans s.dualNatAlt).
  if (fx.natSwitchAlt) {
    const target = altNatOf(s);
    if (target) {
      const from = s.nationality;
      s.nationality = target;
      s.flags.natSwitched = true;
      s.natSwitchFrom = from.id;
      chips.push({ label: tx(s, "chipNatCall", { target: natForms(target).the }), kind: "trait" });
      s.history.push({ age: s.age, text: tx(s, "natSwitchLate", { target: natForms(target).the, from: natForms(from).the }), impact: 6 });
    }
    s.dualNatAlt = null;
  }
  if (fx.natAltDrop) s.dualNatAlt = null; // refus définitif de l'autre sélection
  if (fx.role) { // ajustement direct du statut au club (ex. « tu restes → tu perds ta place »)
    const before = typeof s.role === "number" ? s.role : 2;
    s.role = clamp(before + fx.role, 0, 4);
    if (s.role !== before) chips.push({ label: tx(s, fx.role > 0 ? "chipRolePromo" : "chipRoleDemo", { role: ROLES[s.role].label }), kind: fx.role > 0 ? "good" : "bad" });
  }
  if (fx.money) {
    let d = fx.money;
    if (d > 0 && hasTrait(s, "mercenary")) d *= 1.2;
    s.money = Math.max(0, s.money + d);
    chips.push({ label: `${d > 0 ? "+" : "−"}${fmtMoney(Math.abs(d))}`, kind: d > 0 ? "money" : "bad" });
  }
  if (fx.salaryMult) {
    s.contract.salary = Math.round(s.contract.salary * fx.salaryMult * 100) / 100;
    chips.push({ label: `📈 Salaire : ${fmtMoney(s.contract.salary)}/an`, kind: "money" });
  }
  if (fx.archetype) {
    const arch = ARCHETYPES.find((a) => a.id === fx.archetype);
    if (arch) {
      s.archetype = arch;
      chips.push({ label: `🧬 ${arch.name} : ${arch.effect || arch.desc}`, kind: "trait" });
    }
  }
  if (fx.ban) {
    s.injuryWeeks += fx.ban;
    chips.push({ label: tx(s, "chipBan", { weeks: fx.ban }), kind: "bad" });
  }
  if (fx.inj) {
    const weeks = applyInjury(s, fx.inj); // modulation traits + répartition saison/chronique + fragilité
    chips.push({ label: `🩹 ${weeks} semaines d'absence`, kind: "bad" });
  }
  if (fx.chronic) {
    let w = fx.chronic;
    if (hasTrait(s, "ironman")) w = Math.round(w * 0.6);
    else if (hasTrait(s, "glass")) w = Math.round(w * 1.5);
    s.chronicWeeks = (s.chronicWeeks || 0) + Math.max(1, w);
  }
  if (fx.pot) s.potCap = clamp(s.potCap + fx.pot, 68, 99);
  if (fx.clubBoost) {
    const newLvl = shiftClubLevel(s, s.club, fx.clubBoost);
    chips.push({ label: `🏗️ ${s.club.name} passe en ${divShort(newLvl, s.club.countryId)}`, kind: "trophy" });
    s.history.push({ age: s.age, text: tx(s, "clubInvestor", { div: divShort(newLvl, s.club.countryId) }), impact: 8 });
  }
  if (fx.trait && !hasTrait(s, fx.trait)) {
    s.traits.push(fx.trait);
    const t = TRAITS[fx.trait];
    chips.push({ label: `${t.icon} Trait : ${t.name}`, kind: "trait" });
  }
  if (fx.flag) s.flags[fx.flag] = true;
  if (fx.clearFlag) delete s.flags[fx.clearFlag];
  if (fx.clearTrait) s.traits = s.traits.filter((t) => t !== fx.clearTrait);
  if (fx.sched) s.scheduled.push({ id: fx.sched.id, age: s.age + fx.sched.inYears });
  if (fx.trophy) {
    s.seasonTrophies.push(fx.trophy);
    const comp = COMPETITIONS[fx.trophy];
    if (comp) chips.push({ label: `${comp.icon} ${comp.name} !`, kind: "trophy" });
  }
  if (fx.award) {
    // Distinction individuelle promise par un événement : créditée au
    // bilan de la saison en cours (cf. playSeason), comme fx.trophy.
    if (!s.seasonAwards) s.seasonAwards = [];
    s.seasonAwards.push(fx.award);
    const aw = AWARDS[fx.award];
    if (aw) chips.push({ label: `${aw.icon} ${aw.name} !`, kind: "trophy" });
  }
  if (fx.natCall && !s.natTeam.active && !s.natTeam.retired) {
    // Idempotent : si déjà international, l'événement reste cohérent (pas de doublon)
    s.natTeam.active = true;
    // Une première sélection décrochée PAR ÉVÉNEMENT compte autant que celle
    // décrochée par les seuils d'advanceYear : sans ces drapeaux, le badge
    // « Premier de cordée » et la quête « Pépite » restaient hors d'atteinte.
    if (s.age <= 18) s.flags.early_cap = true;
    if (s.age <= 20) s.flags.young_int = true;
    chips.push({ label: `${s.nationality.flag} International !`, kind: "trophy" });
  }
  if (fx.natRetire) {
    s.natTeam.active = false;
    s.natTeam.retired = true;
    chips.push({ label: `${s.nationality.flag} Retraite internationale`, kind: "neutral" });
  }
  if (fx.retire) {
    s.retiring = true;
    chips.push({ label: tx(s, "chipRetire"), kind: "neutral" });
  }
  if (fx.end) {
    s.careerEnded = true;
    s.careerEndReason = fx.end;
  }
  return chips;
}
