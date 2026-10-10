/* =========================================================
   PARIKSHAMANTR
   PREVIOUS YEAR QUESTION BANK BRIDGE — FINAL FIXED

   PAID:
   JBT  -> jbt-data.js
   TGT  -> tgt-data.js
   JOA  -> joadatajspyq.js

   FREE:
   free-previous-year-one-mock-demo-data.js

   IMPORTANT:
   - Login untouched
   - Razorpay untouched
   - Payment untouched
   - Supabase untouched
   - Only question-bank connection/normalisation handled here
   ========================================================= */
(function () {
  "use strict";

  window.previousYearQuestionBanks = window.previousYearQuestionBanks || {};
  window.freePreviousYearDemoQuestionBanks = window.freePreviousYearDemoQuestionBanks || {};

  /* =======================================================
     ANSWER NORMALIZER
     Internal answer index:
     A=0, B=1, C=2, D=3

     IMPORTANT FIX:
     Existing paid JBT/TGT data uses numeric 0..3.
     JOA/free data normally uses A-D. Numeric 1..4 is also
     accepted only when it is not already a 0..3 source index.
     ======================================================= */
  function normalizeAnswer(value) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number" && isFinite(value)) {
      if (value >= 0 && value <= 3) return value;
      if (value >= 1 && value <= 4) return value - 1;
    }

    var text = String(value).trim().toUpperCase();
    var direct = {
      "A": 0, "B": 1, "C": 2, "D": 3,
      "1": 0, "2": 1, "3": 2, "4": 3, "0": 0,
      "1ST": 0, "2ND": 1, "3RD": 2, "4TH": 3
    };

    if (Object.prototype.hasOwnProperty.call(direct, text)) return direct[text];

    var letter = text.match(/\b([ABCD])\b/);
    return letter ? direct[letter[1]] : null;
  }

  function optionText(option) {
    if (option === null || option === undefined) return "";
    if (typeof option === "string") return option.trim();
    if (typeof option === "object") {
      return String(option.text || option.label || option.value || "").trim();
    }
    return String(option).trim();
  }

  function fourOptions(source) {
    var out = [];
    var arr = Array.isArray(source) ? source : [];
    for (var i = 0; i < 4; i++) out.push(optionText(arr[i]));
    return out;
  }

  /* =======================================================
     PAID ARRAY BANK MAPPER — JBT / TGT
     Supports both the supplied array format and object format.
     ======================================================= */
  function mapArrayBank(exam, source) {
    if (!source || typeof source !== "object") return {};

    var output = {};

    Object.keys(source).forEach(function (mockNumber) {
      var rawBank = source[mockNumber];
      if (!Array.isArray(rawBank)) return;

      output[String(mockNumber)] = rawBank.map(function (q, index) {
        if (Array.isArray(q)) {
          var opts = [q[2] || "", q[3] || "", q[4] || "", q[5] || ""];
          return {
            id: exam + "-" + mockNumber + "-" + (index + 1),
            hindi: String(q[0] || ""),
            english: String(q[1] || q[0] || ""),
            optionsHindi: opts.slice(),
            optionsEnglish: opts.slice(),
            answer: normalizeAnswer(q[6])
          };
        }

        if (q && typeof q === "object") {
          var normal = Array.isArray(q.options) ? q.options.map(optionText) : [];
          var hiOpts = Array.isArray(q.optionsHindi) ? q.optionsHindi :
            (Array.isArray(q.optionsHi) ? q.optionsHi : normal);
          var enOpts = Array.isArray(q.optionsEnglish) ? q.optionsEnglish :
            (Array.isArray(q.optionsEn) ? q.optionsEn : normal);

          return {
            id: q.id || exam + "-" + mockNumber + "-" + (index + 1),
            hindi: String(q.hindi || q.questionHindi || q.hi || q.question || ""),
            english: String(q.english || q.questionEnglish || q.en || q.question || q.hindi || q.hi || ""),
            optionsHindi: fourOptions(hiOpts),
            optionsEnglish: fourOptions(enOpts),
            answer: normalizeAnswer(
              q.answer !== undefined ? q.answer :
              (q.correctAnswer !== undefined ? q.correctAnswer : q.correct)
            )
          };
        }

        return {
          id: exam + "-" + mockNumber + "-" + (index + 1),
          hindi: "",
          english: "",
          optionsHindi: ["", "", "", ""],
          optionsEnglish: ["", "", "", ""],
          answer: null
        };
      });
    });

    return output;
  }

  /* =======================================================
     PAID JBT
     ======================================================= */
  if (typeof jbtPaidMocks !== "undefined" && jbtPaidMocks) {
    window.previousYearQuestionBanks.JBT = mapArrayBank("JBT", jbtPaidMocks);
    console.log(
      "JBT PAID CONNECTED:",
      Object.keys(window.previousYearQuestionBanks.JBT).map(function (key) {
        return "Mock " + key + " = " + window.previousYearQuestionBanks.JBT[key].length + " questions";
      }).join(" | ")
    );
  } else {
    console.error("JBT DATA NOT FOUND: jbtPaidMocks");
  }

  /* =======================================================
     PAID TGT
     ======================================================= */
  if (typeof tgtPaidMocks !== "undefined" && tgtPaidMocks) {
    window.previousYearQuestionBanks.TGT = mapArrayBank("TGT", tgtPaidMocks);
    console.log(
      "TGT PAID CONNECTED:",
      Object.keys(window.previousYearQuestionBanks.TGT).map(function (key) {
        return "Mock " + key + " = " + window.previousYearQuestionBanks.TGT[key].length + " questions";
      }).join(" | ")
    );
  } else {
    console.error("TGT DATA NOT FOUND: tgtPaidMocks");
  }

  /* =======================================================
     JOA RAW OPTION PARSER

     Some supplied JOA questions have fewer than four structured
     options even though the original q.raw contains all options.
     This parser fills those missing options from q.raw.
     ======================================================= */
  function parseRawJOAOptions(raw) {
    var text = String(raw || "")
      .replace(/\r/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    var result = ["", "", "", ""];
    if (!text) return result;

    var markers = [
      /\(A\)\s*/i,
      /\(B\)\s*/i,
      /\(C\)\s*/i,
      /\(D\)\s*/i
    ];

    var pos = [];
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i].exec(text);
      pos.push(m ? { start: m.index, end: m.index + m[0].length } : null);
    }

    if (pos[0]) {
      for (var j = 0; j < 4; j++) {
        if (!pos[j]) continue;
        var end = text.length;
        for (var k = j + 1; k < 4; k++) {
          if (pos[k]) {
            end = pos[k].start;
            break;
          }
        }
        result[j] = text.slice(pos[j].end, end)
          .replace(/\s+(?:ANSWER|CORRECT ANSWER|ANSWER KEY|SOURCE MARKED ANSWER|VERIFIED ANSWER|VERIFICATION)\s*[:=].*$/i, "")
          .trim();
      }
    }

    return result;
  }

  function mergeJOAOptions(existing, raw) {
    var structured = Array.isArray(existing) ? existing.map(optionText) : [];
    var parsed = parseRawJOAOptions(raw);
    var finalOptions = [];

    for (var i = 0; i < 4; i++) {
      finalOptions[i] = structured[i] || parsed[i] || "";
    }

    return finalOptions;
  }

  /* =======================================================
     PAID JOA
     Mock 1 = postCode817 = 170
     Mock 2 = postCode903 = 170
     Mock 3 = postCode1000 = 200
     Mock 4 = postCode939 = 200
     ======================================================= */
  var joaSource =
    (typeof joadatajspyq !== "undefined" && joadatajspyq) ? joadatajspyq :
    ((typeof joaItData !== "undefined" && joaItData) ? joaItData :
    (window.joadatajspyq || window.joaItData || null));

  if (joaSource && typeof joaSource === "object") {
    var joaMap = {};
    var joaOrder = [
      ["postCode817", 170],
      ["postCode903", 170],
      ["postCode1000", 200],
      ["postCode939", 200]
    ];

    joaOrder.forEach(function (item, paperIndex) {
      var paperKey = item[0];
      var expected = item[1];
      var paper = joaSource[paperKey];

      if (!paper || !Array.isArray(paper.questions)) {
        console.error("JOA paper missing:", paperKey);
        return;
      }

      joaMap[String(paperIndex + 1)] = paper.questions
        .slice(0, expected)
        .map(function (q, index) {
          q = q || {};

          var options = mergeJOAOptions(q.options, q.raw);
          var question = q.question || q.questionEnglish || q.hindi || "";
          var hindi = q.hindi || q.questionHindi || q.question || "";

          return {
            id: "JOA-" + paperKey + "-" + (index + 1),
            hindi: String(hindi),
            english: String(question),
            optionsHindi: options.slice(),
            optionsEnglish: options.slice(),
            answer: normalizeAnswer(
              q.answer !== undefined ? q.answer : q.correctAnswer
            ),
            sourcePaper: paper.paperName || paperKey
          };
        });
    });

    // Additional JOA papers are auto-numbered as Mock 5 onward when real
    // question arrays are present in the uploaded joadatajspyq.js source.
    var knownJOAKeys = joaOrder.map(function(item){ return item[0]; });
    var nextJOAMock = 5;
    Object.keys(joaSource).forEach(function(paperKey){
      if(knownJOAKeys.indexOf(paperKey) !== -1) return;
      var paper = joaSource[paperKey];
      if(!paper || !Array.isArray(paper.questions) || !paper.questions.length) return;
      while(joaMap[String(nextJOAMock)]) nextJOAMock++;
      joaMap[String(nextJOAMock)] = paper.questions.slice(0,120).map(function(q,index){
        q = q || {};
        var options = mergeJOAOptions(q.options, q.raw);
        var question = q.question || q.questionEnglish || q.english || q.hindi || "";
        var hindi = q.hindi || q.questionHindi || q.question || "";
        return {
          id: "JOA-" + paperKey + "-" + (index + 1),
          hindi: String(hindi),
          english: String(question),
          optionsHindi: options.slice(),
          optionsEnglish: options.slice(),
          answer: normalizeAnswer(q.answer !== undefined ? q.answer : q.correctAnswer),
          sourcePaper: paper.paperName || paperKey
        };
      });
      nextJOAMock++;
    });

    window.previousYearQuestionBanks.JOA = joaMap;

    console.log(
      "JOA PAID CONNECTED:",
      Object.keys(joaMap).map(function (key) {
        return "Mock " + key + " = " + joaMap[key].length + " questions";
      }).join(" | ")
    );
  } else {
    console.error("JOA DATA NOT FOUND: joadatajspyq");
  }

  /* =======================================================
     OTHER PAID SUBJECT BANKS
     Supports the existing Patwari/Police data files and
     subject-specific JS files uploaded later.
     ======================================================= */
  function connectPaidBank(examName, source) {
    if (!source || typeof source !== "object") return;
    var mapped = mapArrayBank(examName, source);
    var usable = {};
    Object.keys(mapped).forEach(function(key) {
      if (/^\d+$/.test(key) && Array.isArray(mapped[key]) && mapped[key].length) {
        usable[key] = mapped[key];
      }
    });
    if (Object.keys(usable).length) {
      window.previousYearQuestionBanks[examName] = usable;
      console.log("PAID " + examName + " CONNECTED:", Object.keys(usable).map(function(key) {
        return "Mock " + key + " = " + usable[key].length + " questions";
      }).join(" | "));
    }
  }

  if (typeof patwariPaidMocks !== "undefined") connectPaidBank("Patwari", patwariPaidMocks);
  if (typeof policePaidMocks !== "undefined") connectPaidBank("Police", policePaidMocks);
  if (typeof forestGuardPaidMocks !== "undefined") connectPaidBank("Forest Guard", forestGuardPaidMocks);
  else if (typeof forestPaidMocks !== "undefined") connectPaidBank("Forest Guard", forestPaidMocks);
  if (typeof staffNursePaidMocks !== "undefined") connectPaidBank("Staff Nurse", staffNursePaidMocks);
  else if (typeof staffNurseMocks !== "undefined") connectPaidBank("Staff Nurse", staffNurseMocks);
  if (typeof pgtPaidMocks !== "undefined") connectPaidBank("PGT", pgtPaidMocks);
  else if (typeof pgtMocks !== "undefined") connectPaidBank("PGT", pgtMocks);

  /* =======================================================
     FREE MASTER DATA
     ======================================================= */
  var freeData =
    typeof PARIKSHAMANTR_PREVIOUS_YEAR_DATA !== "undefined"
      ? PARIKSHAMANTR_PREVIOUS_YEAR_DATA
      : null;

  var freeMap = {
    "JBT": "JBT_2026_27_FEB_3RD_SHIFT",
    "JOA": "JOA_IT_2022_SERIES_A",
    "TGT": "TGT_ARTS_2026_16_JAN_SHIFT_3",
    "Forest Guard": "HP_FOREST_GUARD_2021_SERIES_B",
    "Patwari": "HP_PATWARI_2019",
    "Staff Nurse": "ASSISTANT_STAFF_NURSE_2026",
    "PGT": "PGT_HISTORY_2020",
    "Police": "HP_POLICE_CONSTABLE_2025"
  };

  /* Verified usable targets from the supplied master file.
     Patwari is deliberately capped at the clean verified block count
     available in the supplied source; no missing questions are invented. */
  var freeCounts = {
    "JBT": 200,
    "TGT": 200,
    "Patwari": 25,
    "JOA": 200,
    "Staff Nurse": 120,
    "PGT": 85,
    "Police": 90,
    "Forest Guard": 85
  };

  function clean(value) {
    return String(value || "")
      .replace(/\\n/g, "\n")
      .replace(/\r/g, "")
      .trim();
  }

  function answerFromText(text) {
    var value = String(text || "");
    var patterns = [
      /(?:VERIFIED\s+ANSWER|CORRECT\s+ANSWER|CORRECT\s+ANSWER\s*KEY|SOURCE\s+MARKED\s+ANSWER|ANSWER\s+KEY|ANSWER\s+TEXT|FINAL\s+ANSWER\s+KEY|ANSWER)(?:\s*\/\s*[^:=]{0,100})?\s*[:=]\s*\(?\s*([A-D])\s*\)?/i,
      /\b(?:VERIFIED\s+ANSWER|ANSWER\s+KEY|ANSWER)\b[\s\S]{0,100}?\(?\s*([A-D])\s*\)?/i
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = value.match(patterns[i]);
      if (match) return normalizeAnswer(match[1]);
    }

    return null;
  }

  function extractFreeOptions(raw) {
    var text = String(raw || "")
      .replace(/\r/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    var opts = ["", "", "", ""];
    if (!text) return opts;

    /* Find the first A option, then capture A/B/C/D up to the next marker. */
    var marker = /(?:^|\s)(?:\(A\)|A[.)])\s*/i.exec(text);
    if (!marker) return opts;

    var tail = text.slice(marker.index + marker[0].length);
    var optionPattern = /(?:^|\s)(?:\(A\)|A[.)])\s*([\s\S]*?)(?=\s+(?:\(B\)|B[.)])\s*)|\s+(?:\(B\)|B[.)])\s*([\s\S]*?)(?=\s+(?:\(C\)|C[.)])\s*)|\s+(?:\(C\)|C[.)])\s*([\s\S]*?)(?=\s+(?:\(D\)|D[.)])\s*)|\s+(?:\(D\)|D[.)])\s*([\s\S]*?)(?=\s+(?:ANSWER|VERIFIED|CORRECT|SOURCE|CANDIDATE|FINAL|VERIFICATION)\b|$)/i;
    var m = optionPattern.exec(text);

    if (m) {
      if (m[1]) opts[0] = m[1].trim();
      if (m[2]) opts[1] = m[2].trim();
      if (m[3]) opts[2] = m[3].trim();
      if (m[4]) opts[3] = m[4].trim();
    }

    /* More reliable sequential extraction for mixed OCR / pipe formats. */
    var markers = [
      /(?:^|\s)(?:\(A\)|A[.)])\s*/i,
      /(?:^|\s)(?:\(B\)|B[.)])\s*/i,
      /(?:^|\s)(?:\(C\)|C[.)])\s*/i,
      /(?:^|\s)(?:\(D\)|D[.)])\s*/i
    ];

    var positions = [];
    for (var i = 0; i < markers.length; i++) {
      var mm = markers[i].exec(text);
      positions.push(mm ? { start: mm.index, end: mm.index + mm[0].length } : null);
    }

    for (var j = 0; j < 4; j++) {
      if (!positions[j]) continue;
      var end = text.length;
      for (var k = j + 1; k < 4; k++) {
        if (positions[k]) {
          end = positions[k].start;
          break;
        }
      }
      var value = text.slice(positions[j].end, end)
        .replace(/\s+(?:ANSWER|VERIFIED|CORRECT|SOURCE|CANDIDATE|FINAL|VERIFICATION)\b[\s\S]*$/i, "")
        .trim();
      if (value) opts[j] = value;
    }

    return opts;
  }

  function splitFreeQuestions(text) {
    var source = clean(text);
    var regex = /(?:^|\n)\s*Q(?:uestion)?\s*(\d+)\s*(?:\.|(?=\s|$))/gi;
    var found = [];
    var match;
    var lastEnd = 0;

    while ((match = regex.exec(source))) {
      if (found.length) {
        found[found.length - 1].raw = source.slice(lastEnd, match.index).trim();
      }
      found.push({ number: Number(match[1]), raw: "" });
      lastEnd = regex.lastIndex;
    }

    if (found.length) {
      found[found.length - 1].raw = source.slice(lastEnd).trim();
    }

    return found;
  }

  function buildFreeBank(examName, sourceExam, count) {
    if (!freeData || !freeData.exams || !freeData.exams[sourceExam]) {
      console.error("FREE SOURCE MISSING:", examName, sourceExam);
      return [];
    }

    var source = freeData.exams[sourceExam];
    var blocks = [];

    /* questionBlocks are not uniformly shaped across the 8 supplied exams.
       The authoritative sourceText is therefore preferred for parsing. */
    blocks = splitFreeQuestions(source.sourceText || "");

    /* Fall back to questionBlocks only when sourceText could not be split. */
    if (!blocks.length && Array.isArray(source.questionBlocks) && source.questionBlocks.length) {
      blocks = source.questionBlocks.map(function (block, index) {
        if (!block) return null;
        return {
          number: Number(block.id || index + 1),
          raw: typeof block === "string" ? block : String(block.raw || "")
        };
      }).filter(Boolean);
    }

    var result = [];

    blocks.forEach(function (block, index) {
      if (result.length >= count) return;

      var raw = clean(block.raw);
      if (!raw) return;

      var answer = answerFromText(raw);

      var flat = raw.replace(/\r/g, " ").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      var firstOption = flat.search(/(?:^|\s)(?:\(A\)|A[.)])\s*/i);
      var qText = firstOption >= 0 ? flat.slice(0, firstOption).trim() : flat;
      qText = qText
        .replace(/^Q(?:uestion)?\s*\d+\s*\.?\s*/i, "")
        .replace(/^English:\s*/i, "")
        .trim();

      var options = extractFreeOptions(raw);

      if (!qText && options.every(function (x) { return !x; })) return;

      result.push({
        id: "FREE-" + examName + "-" + (index + 1),
        hindi: qText,
        english: qText,
        optionsHindi: options.slice(),
        optionsEnglish: options.slice(),
        answer: answer,
        sourceQuestionNumber: block.number
      });
    });

    return result.slice(0, count);
  }

  if (freeData) {
    Object.keys(freeMap).forEach(function (examName) {
      var bank = buildFreeBank(examName, freeMap[examName], freeCounts[examName]);
      window.freePreviousYearDemoQuestionBanks[examName] = bank;
      console.log(
        "FREE DEMO " + examName + ": " + bank.length + "/" + freeCounts[examName] + " questions"
      );
    });
  } else {
    console.error("FREE MASTER DATA NOT FOUND: PARIKSHAMANTR_PREVIOUS_YEAR_DATA");
  }

  /* =======================================================
     FINAL VERIFICATION SUMMARY
     ======================================================= */
  console.log("==============================================");
  console.log("PARIKSHAMANTR PREVIOUS YEAR BRIDGE READY");
  console.log("PAID BANKS:", Object.keys(window.previousYearQuestionBanks));
  console.log("FREE BANKS:", Object.keys(window.freePreviousYearDemoQuestionBanks));
  console.log("==============================================");

})();
