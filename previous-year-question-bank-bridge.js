/* =========================================================
   PARIKSHAMANTR — PREVIOUS YEAR QUESTION BANK BRIDGE FINAL
   PAID: JBT + TGT unchanged; JOA added from joadatajspyq.js
   FREE: adapter for PARIKSHAMANTR_PREVIOUS_YEAR_DATA
   ========================================================= */
(function () {
  'use strict';

  window.previousYearQuestionBanks = window.previousYearQuestionBanks || {};
  window.freePreviousYearDemoQuestionBanks = window.freePreviousYearDemoQuestionBanks || {};

  function mapArrayBank(exam, source) {
    if (!source || typeof source !== 'object') return {};
    var out = {};
    Object.keys(source).forEach(function (mockNumber) {
      var raw = source[mockNumber];
      if (!Array.isArray(raw)) return;
      out[mockNumber] = raw.map(function (q, index) {
        return {
          id: exam + '-' + mockNumber + '-' + (index + 1),
          hindi: q[0] || '',
          english: q[1] || '',
          optionsHindi: [q[2] || '', q[3] || '', q[4] || '', q[5] || ''],
          optionsEnglish: [q[2] || '', q[3] || '', q[4] || '', q[5] || ''],
          answer: typeof q[6] === 'number' ? q[6] : null
        };
      });
    });
    return out;
  }

  /* ---------- PAID JBT: unchanged ---------- */
  if (typeof jbtPaidMocks !== 'undefined') {
    window.previousYearQuestionBanks.JBT = mapArrayBank('JBT', jbtPaidMocks);
  } else {
    console.error('JBT paid data not loaded. Keep ./jbt-data.js before this bridge.');
  }

  /* ---------- PAID TGT: unchanged ---------- */
  if (typeof tgtPaidMocks !== 'undefined') {
    window.previousYearQuestionBanks.TGT = mapArrayBank('TGT', tgtPaidMocks);
  } else {
    console.error('TGT paid data not loaded. Keep ./tgt-data.js before this bridge.');
  }

  /* ---------- PAID JOA: NEW ----------
     joadatajspyq.js contains exactly:
     817 = 170, 903 = 170, 1000 = 200, 939 = 200.
     These become Mock 1..4 respectively.
  */
  if (typeof joadatajspyq !== 'undefined' && joadatajspyq) {
    var joaMap = {};
    var joaOrder = ['postCode817', 'postCode903', 'postCode1000', 'postCode939'];

    joaOrder.forEach(function (paperKey, paperIndex) {
      var paper = joadatajspyq[paperKey];
      if (!paper || !Array.isArray(paper.questions)) return;

      joaMap[String(paperIndex + 1)] = paper.questions.map(function (q, index) {
        var opts = Array.isArray(q.options) ? q.options : [];
        return {
          id: 'JOA-' + paperKey + '-' + (index + 1),
          hindi: q.hindi || '',
          english: q.question || '',
          optionsHindi: [
            opts[0] && opts[0].text || '',
            opts[1] && opts[1].text || '',
            opts[2] && opts[2].text || '',
            opts[3] && opts[3].text || ''
          ],
          optionsEnglish: [
            opts[0] && opts[0].text || '',
            opts[1] && opts[1].text || '',
            opts[2] && opts[2].text || '',
            opts[3] && opts[3].text || ''
          ],
          answer: q.answer || null,
          sourcePaper: paper.paperName || paperKey
        };
      });
    });

    window.previousYearQuestionBanks.JOA = joaMap;
    console.log('JOA paid FINAL connected:', Object.keys(joaMap).map(function (k) {
      return 'Mock ' + k + ' = ' + joaMap[k].length;
    }).join(', '));
  } else {
    console.error('JOA paid data not loaded. Add ./joadatajspyq.js before this bridge.');
  }

  /* ---------- FREE DEMO ----------
     The uploaded master file exposes PARIKSHAMANTR_PREVIOUS_YEAR_DATA.
     This adapter intentionally does NOT invent missing questions.
  */
  var freeData = window.PARIKSHAMANTR_PREVIOUS_YEAR_DATA;
  var freeMap = {
    JBT: 'JBT_2026_27_FEB_3RD_SHIFT',
    JOA: 'JOA_IT_2022_SERIES_A',
    TGT: 'TGT_ARTS_2026_16_JAN_SHIFT_3',
    'Forest Guard': 'HP_FOREST_GUARD_2021_SERIES_B',
    Patwari: 'HP_PATWARI_2019',
    'Staff Nurse': 'ASSISTANT_STAFF_NURSE_2026',
    PGT: 'PGT_HISTORY_2020',
    Police: 'HP_POLICE_CONSTABLE_2025'
  };

  function clean(s) {
    return String(s || '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  }

  function answerFromText(text) {
    var m = String(text || '').match(/(?:VERIFIED ANSWER(?: KEY)?|ANSWER KEY\s*\/[^\n]*|VERIFIED ANSWER|CORRECT ANSWER|ANSWER(?:\s*\/[^:]+)?)\s*[:=]\s*\(?([A-D])\)?/i);
    return m ? m[1].toUpperCase() : null;
  }

  function splitByQ(text) {
    var s = clean(text), re = /(?:^|\n)Q(\d+)(?:\.|\s|$)/g;
    var found = [], m, last = 0;
    while ((m = re.exec(s))) {
      if (found.length) found[found.length - 1].raw = s.slice(last, m.index).trim();
      found.push({ number: Number(m[1]), raw: '' });
      last = m.index;
    }
    if (found.length) found[found.length - 1].raw = s.slice(last).trim();
    return found;
  }

  function extractOptions(raw) {
    var lines = String(raw || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var opts = { A: '', B: '', C: '', D: '' };

    lines.forEach(function (line) {
      var m = line.match(/(?:^|\s|\()([A-D])(?:\)|\.)\s*(.*)$/i);
      if (m && !opts[m[1].toUpperCase()]) opts[m[1].toUpperCase()] = m[2].trim();
    });

    var inline = String(raw || '').match(/\(A\)\s*([^\n]+?)\s+\(B\)\s*([^\n]+?)\s+\(C\)\s*([^\n]+?)\s+\(D\)\s*([^\n]+)/i);
    if (inline) {
      ['A','B','C','D'].forEach(function (k, i) { if (!opts[k]) opts[k] = inline[i + 1].trim(); });
    }
    return [opts.A, opts.B, opts.C, opts.D];
  }

  function makeBank(examName, sourceExam) {
    if (!freeData || !freeData.exams || !freeData.exams[sourceExam]) return [];
    var src = freeData.exams[sourceExam];
    var blocks = splitByQ(src.sourceText || '');

    /* TGT source contains 400 entries but the Free Demo requirement is 200.
       Use the first 200 source questions only. */
    if (examName === 'TGT') blocks = blocks.slice(0, 200);

    return blocks.map(function (b, index) {
      var raw = b.raw || '';
      var lines = raw.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var qText = lines.filter(function (line) {
        return !/^(A|B|C|D)[.)]/i.test(line) &&
               !/^Options:/i.test(line) &&
               !/^(VERIFIED ANSWER|ANSWER KEY|ANSWER TEXT|VERIFICATION|FINAL ANSWER KEY)/i.test(line);
      }).slice(0, 2).join(' ');

      var opts = extractOptions(raw);
      return {
        id: 'FREE-' + examName + '-' + (index + 1),
        hindi: qText,
        english: qText,
        optionsHindi: opts,
        optionsEnglish: opts,
        answer: answerFromText(raw),
        sourceQuestionNumber: b.number
      };
    });
  }

  if (freeData) {
    Object.keys(freeMap).forEach(function (examName) {
      window.freePreviousYearDemoQuestionBanks[examName] = makeBank(examName, freeMap[examName]);
    });

    console.log('FREE DEMO banks prepared:', Object.keys(window.freePreviousYearDemoQuestionBanks).map(function (k) {
      return k + '=' + window.freePreviousYearDemoQuestionBanks[k].length;
    }).join(', '));
  } else {
    console.error('Free master data not loaded. Add ./free-previous-year-one-mock-demo-data.js before this bridge.');
  }

})();
