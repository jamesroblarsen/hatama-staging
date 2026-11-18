// Latin Toba spelling -> Toba Batak script (surat Batak, Unicode block U+1BC0-U+1BFF).
//
// Rules (Toba conventions; to be checked by a reader of surat Batak):
//  * ina ni surat (letters with an inherent a): a ha ma na ra ta sa pa la ga ja da nga ba wa ya nya i u.
//    Toba has no separate KA: /k/ is written with HA (e.g. final -k in dolok).
//    TA uses the southern form, the one in the Toba/Angkola-Mandailing tradition.
//  * anak ni surat (diacritics): hatadingan e, hauluan i, sihora/siala o, haboruan u,
//    haminsaran (paminggil) for final -ng, the -h sign, and pangolat to kill the inherent vowel.
//  * A syllable starting with a vowel uses the letter A with the vowel sign; an open syllable that is
//    just i or u uses the independent letters I and U.
//  * Text is encoded in phonetic order (onset, vowel sign, coda); fonts reorder the vowel sign to after
//    a pangolat-final consonant, as the script requires.
const L = {
  a: 'ᯀ', h: 'ᯂ', k: 'ᯂ', b: 'ᯅ', p: 'ᯇ', n: 'ᯉ', w: 'ᯋ', g: 'ᯎ',
  j: 'ᯐ', d: 'ᯑ', r: 'ᯒ', m: 'ᯔ', t: 'ᯖ', s: 'ᯘ', y: 'ᯛ', ng: 'ᯝ',
  l: 'ᯞ', ny: 'ᯠ', c: 'ᯡ', I: 'ᯤ', U: 'ᯥ',
};
const VOWEL_SIGN = { a: '', e: 'ᯧ', i: 'ᯪ', o: 'ᯬ', u: 'ᯮ' };
const NG_SIGN = 'ᯰ';
const H_SIGN = 'ᯱ';
const PANGOLAT = '᯲';
const VOWELS = 'aeiou';

/** Splits a word into consonant units (ng and ny are single units) and vowels. */
function units(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    const two = word.slice(i, i + 2);
    if ((two === 'ng' || two === 'ny') && i + 2 <= word.length) { out.push(two); i++; }
    else out.push(word[i]);
  }
  return out;
}

/** Returns the word in Toba Batak script, or null if it has a letter the script cannot write. */
export function toBatak(word) {
  const u = units(word.toLowerCase());
  const isV = (x) => x && VOWELS.includes(x);
  let out = '';
  let i = 0;
  while (i < u.length) {
    // onset (at most one consonant unit) + vowel
    let onset = null;
    if (!isV(u[i])) { onset = u[i]; i++; }
    if (isV(u[i])) {
      const v = u[i]; i++;
      // coda: a consonant not followed by a vowel
      let coda = null;
      if (i < u.length && !isV(u[i]) && !isV(u[i + 1])) { coda = u[i]; i++; }
      if (onset) {
        if (!L[onset]) return null;
        out += L[onset] + VOWEL_SIGN[v];
      } else if (!coda && (v === 'i' || v === 'u')) {
        out += v === 'i' ? L.I : L.U;
      } else {
        out += L.a + VOWEL_SIGN[v];
      }
      if (coda) {
        if (coda === 'ng') out += NG_SIGN;
        else if (coda === 'h') out += H_SIGN;
        else if (L[coda]) out += L[coda] + PANGOLAT;
        else return null;
      }
    } else {
      // consonant with no vowel after it (a cluster this simple splitter did not absorb)
      if (!L[onset]) return null;
      out += L[onset] + PANGOLAT;
    }
  }
  return out;
}
