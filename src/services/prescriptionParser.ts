export type DurationUnit = 'day' | 'week' | 'month';

export interface ParsedSchedule {
  time: string;
  quantity: number;
}

export interface ParsedPrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  instructions: string;
  schedules: ParsedSchedule[];
  startDate: string;
  endDate: string;
  durationText: string;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  rawText: string;
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  janwary: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,

  जनवरी: 0,
  फरवरी: 1,
  मार्च: 2,
  अप्रैल: 3,
  मई: 4,
  जून: 5,
  जुलाई: 6,
  अगस्त: 7,
  सितंबर: 8,
  सितम्बर: 8,
  अक्टूबर: 9,
  अक्तूबर: 9,
  नवंबर: 10,
  नवम्बर: 10,
  दिसंबर: 11,
  दिसम्बर: 11,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,

  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  पंद्रह: 15,
  बीस: 20,
  तीस: 30,
};

const MONTH_TOKEN =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|अक्तूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर)';

const DATE_TOKEN = `(?:\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{1,2}\\s+${MONTH_TOKEN}[a-z\\u0900-\\u097F]*\\.?,?\\s+\\d{2,4}|${MONTH_TOKEN}[a-z\\u0900-\\u097F]*\\.?\\s+\\d{1,2},?\\s+\\d{2,4})`;

const AMOUNT_TOKEN = '[0-9OoIl]+(?:[.,][0-9OoIl]+)?';

const DOSE_REGEX = new RegExp(
  `(^|[^A-Za-z])(${AMOUNT_TOKEN})\\s*(milligrams?|mcg|µg|ug|mgs?|mg|grams?|gms?|gm|g|millilit(?:er|re)s?|ml|iu|units?|tablets?|tabs?|tab|capsules?|caps?|cap|गोली|मि\\.?\\s*ग्रा\\.?|मिलीग्राम|ग्राम|मि\\.?\\s*ली\\.?|मिलीलीटर|टैबलेट|कैप्सूल|यूनिट)(?![A-Za-z])`,
  'gi'
);

const DOSE_PATTERN_REGEX =
  /(?:^|[\s(])(\d(?:\s*[-+]\s*\d){1,3})(?=[\s),.;]|$)/g;

const DURATION_REGEX = new RegExp(
  `(?:for|take\\s+for|course\\s+of|के\\s+लिए)?\\s*(\\d+|${Object.keys(
    NUMBER_WORDS
  )
    .sort((a, b) => b.length - a.length)
    .join('|')})\\s*(days?|weeks?|wks?|months?|mos?|दिन|सप्ताह|हफ्ते|हफ़्ते|महीने|माह)(?=[\\s,.;)]|$)`,
  'gi'
);

const HEADER_REGEX =
  /^(?:patient|name|age|sex|gender|date|address|doctor|dr\.?|clinic|hospital|diagnosis|complaint|history|advice|investigation|follow\s*up|signature|registration|mobile|phone|reg\.?\s*no|prescription|rx)\b/i;

const DATE_METADATA_REGEX =
  /^(?:start(?:ing)?(?:\s+date)?|from|till|until|upto|up\s+to|end(?:\s+date)?|date|dated|दिनांक|प्रारंभ|शुरू|समाप्त|अंत)(?=\s|[:.\-]|$)/i;

const HINDI_HEADER_REGEX =
  /^(?:रोगी|मरीज|नाम|आयु|उम्र|लिंग|दिनांक|पता|डॉक्टर|चिकित्सक|क्लिनिक|अस्पताल|निदान|शिकायत|इतिहास|सलाह|जांच|जाँच|पर्चा|नुस्खा|हस्ताक्षर|मोबाइल|फोन)/;

const INSTRUCTION_START_REGEX =
  /^(?:take|use|apply|swallow|chew|do\s+not|avoid|complete|as\s+directed|shake|gargle|inhale|खाएं|खाइए|लें|ले|लगाएं|चबाएं|निगलें|मत|न\s+लें|पूरा\s+कोर्स)/i;

const FORM_PREFIX_REGEX =
  /^(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|inj(?:ection)?|drops?|ointment|cream|gel|lotion|spray|inhaler|टैबलेट|टैब|कैप्सूल|कैप|सिरप|इंजेक्शन|बूंदें|मलहम|क्रीम|जेल|स्प्रे|इनहेलर)\b\.?\s*/i;

const FIELD_LABEL_REGEX =
  /^(?:(?:medicine|drug)\s*(?:name)?|(?:दवा|दवाई|औषधि)\s*(?:का)?\s*(?:नाम)?|(?:खुराक|मात्रा|dosage|dose))\s*[:\-]\s*/i;

const STOP_WORDS =
  /\b(?:od|bd|bid|tds|tid|qid|hs|sos|prn|pc|ac|po|stat|once|twice|thrice|daily|times?|every|hours?|weekly|bedtime|morning|afternoon|evening|night|after|before|with|at|food|meal|meals|breakfast|lunch|dinner|empty|stomach|water|take|use|apply|for|days?|weeks?|months?)\b\.?/gi;

const HINDI_STOP_WORDS = new Set([
  'दवा', 'दवाई', 'औषधि', 'नाम', 'खुराक', 'मात्रा', 'दिन', 'बार', 'सुबह',
  'दोपहर', 'शाम', 'रात', 'भोजन', 'खाने', 'खाना', 'पहले', 'बाद', 'साथ',
  'खाली', 'पेट', 'हर', 'घंटे', 'टैबलेट', 'टैब', 'कैप्सूल', 'कैप', 'गोली',
  'सिरप', 'ले', 'लें', 'खाएं', 'खाइए', 'करें', 'तक', 'के', 'का', 'की',
  'से', 'को', 'और', 'या', 'में', 'लिए', 'पूरा', 'कोर्स', 'निर्देशानुसार',
  'बजे',
]);

// Hindi stop words are removed whole-word only. Devanagari has no \b, and a
// bare alternation would corrupt real medicine names containing those
// syllables (e.g. "खाना" inside a longer compound name).
const HINDI_WORD_REGEX = /[\u0900-\u097F]+/g;

function stripHindiStopWords(value: string): string {
  return value.replace(HINDI_WORD_REGEX, (word) =>
    HINDI_STOP_WORDS.has(word) ? ' ' : word
  );
}

function replaceDevanagariDigits(value: string): string {
  return value.replace(/[\u0966-\u096F]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x0966)
  );
}

export function normalizePrescriptionText(text: string): string {
  return replaceDevanagariDigits(text || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/[|¦]/g, ' ')
    .replace(/\uFF1A/g, ':')
    .replace(/\bm\s*9\b/gi, 'mg')
    .replace(/\brng\b/gi, 'mg')
    .replace(/\bm\s*c\s*g\b/gi, 'mcg')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanAmount(value: string): string {
  return value
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(',', '.')
    .replace(/^0+(?=\d)/, '');
}

function canonicalUnit(rawUnit: string) {
  const unit = rawUnit
    .toLowerCase()
    .replace(/[.\s]/g, '')
    .replace(/µ/g, 'u');

  if (
    /^(?:mg|mgs|milligram|milligrams|मिग्रा|मिलीग्राम)$/.test(unit)
  ) {
    return { label: 'mg', type: 'strength' as const };
  }

  if (/^(?:mcg|ug|microgram|micrograms)$/.test(unit)) {
    return { label: 'mcg', type: 'strength' as const };
  }

  if (/^(?:g|gm|gms|gram|grams|ग्राम)$/.test(unit)) {
    return { label: 'g', type: 'strength' as const };
  }

  if (/^(?:ml|milliliter|millilitre|milliliters|millilitres|मिली|मिलीलीटर)$/.test(unit)) {
    return { label: 'ml', type: 'volume' as const };
  }

  if (/^(?:iu|unit|units|यूनिट)$/.test(unit)) {
    return { label: 'units', type: 'unit' as const };
  }

  if (/^(?:tab|tabs|tablet|tablets|टैबलेट|गोली)$/.test(unit)) {
    return { label: 'tablet', type: 'form' as const };
  }

  if (/^(?:cap|caps|capsule|capsules|कैप्सूल)$/.test(unit)) {
    return { label: 'capsule', type: 'form' as const };
  }

  return null;
}

interface DosageMatch {
  text: string;
  index: number;
  dosage: string;
  priority: number;
}

function findDosage(text: string): DosageMatch | null {
  const matches = Array.from(text.matchAll(DOSE_REGEX));

  let best: DosageMatch | null = null;

  for (const match of matches) {
    const index = (match.index ?? 0) + match[1].length;
    const rawUnit = match[3] || '';
    const unit = canonicalUnit(rawUnit);

    if (!unit) continue;

    const amount = cleanAmount(match[2] || '');
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      continue;
    }

    const dosage =
      unit.type === 'form'
        ? `${amount} ${unit.label}${numericAmount === 1 ? '' : 's'}`
        : `${amount}${unit.label}`;

    const priority =
      unit.type === 'strength'
        ? 3
        : unit.type === 'volume'
          ? 2
          : unit.type === 'form'
            ? 1
            : 0;

    const candidate = {
      text: match[0].slice(match[1].length),
      index,
      dosage,
      priority,
    };

    if (
      !best ||
      candidate.priority > best.priority ||
      (candidate.priority === best.priority && candidate.index < best.index)
    ) {
      best = candidate;
    }
  }

  return best;
}

function stripDosage(text: string): string {
  return text.replace(DOSE_REGEX, '$1 ');
}

function normalizeTimeParts(
  hourValue: number,
  minuteValue: number,
  period?: string
): string | null {
  let hour = hourValue;
  let minute = minuteValue;
  let normalizedPeriod = period
    ?.toLowerCase()
    .replace(/[.\s]/g, '')
    .replace('बजे', '');

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (normalizedPeriod === 'सुबह') normalizedPeriod = 'am';
  if (normalizedPeriod === 'दोपहर') normalizedPeriod = 'pm';
  if (normalizedPeriod === 'शाम') normalizedPeriod = 'pm';
  if (normalizedPeriod === 'रात') normalizedPeriod = 'pm';

  if (normalizedPeriod === 'am' || normalizedPeriod === 'a') {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    normalizedPeriod = 'AM';
  } else if (normalizedPeriod === 'pm' || normalizedPeriod === 'p') {
    if (hour < 1 || hour > 12) return null;
    if (hour !== 12) hour += 12;
    normalizedPeriod = 'PM';
  } else if (normalizedPeriod) {
    return null;
  } else if (hour > 23) {
    return null;
  }

  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayPeriod = hour >= 12 ? 'PM' : 'AM';

  return `${displayHour}:${String(minute).padStart(2, '0')} ${displayPeriod}`;
}

export function normalizeTimeInput(value: string): string | null {
  const text = normalizePrescriptionText(value).trim();

  if (!text) return null;

  const twelveHour = text.match(
    /(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)/i
  );

  if (twelveHour) {
    return normalizeTimeParts(
      Number(twelveHour[1]),
      Number(twelveHour[2] || 0),
      twelveHour[3]
    );
  }

  const hindiTime = text.match(
    /(?:सुबह|दोपहर|शाम|रात)?\s*(\d{1,2})(?::(\d{2}))?\s*बजे\s*(?:सुबह|दोपहर|शाम|रात)?/
  );

  if (hindiTime) {
    const periodMatch = text.match(/सुबह|दोपहर|शाम|रात/);
    return normalizeTimeParts(
      Number(hindiTime[1]),
      Number(hindiTime[2] || 0),
      periodMatch?.[0]
    );
  }

  const colonTime = text.match(/^(\d{1,2}):(\d{2})$/);

  if (colonTime) {
    return normalizeTimeParts(
      Number(colonTime[1]),
      Number(colonTime[2])
    );
  }

  return null;
}

function stripTimes(text: string): string {
  return text
    .replace(
      /(?:^|[^\d])\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm|a\.?m\.?|p\.?m\.?)(?![a-z])/gi,
      ' '
    )
    .replace(/(?:^|[^\d])\d{1,2}:\d{2}(?![.\/-]\d)/g, ' ')
    .replace(
      /(?:सुबह|दोपहर|शाम|रात)?\s*\d{1,2}(?::\d{2})?\s*बजे\s*(?:सुबह|दोपहर|शाम|रात)?/g,
      ' '
    );
}

function extractTimes(text: string): string[] {
  const found: string[] = [];

  const add = (value: string | null) => {
    if (value && !found.includes(value)) {
      found.push(value);
    }
  };

  for (const match of text.matchAll(
    /(?:^|[^\d])(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)(?![a-z])/gi
  )) {
    add(
      normalizeTimeParts(
        Number(match[1]),
        Number(match[2] || 0),
        match[3]
      )
    );
  }

  for (const match of text.matchAll(
    /(?:^|[^\d])(\d{1,2}):(\d{2})(?![.\/-]\d)/g
  )) {
    add(
      normalizeTimeParts(
        Number(match[1]),
        Number(match[2])
      )
    );
  }

  for (const match of text.matchAll(
    /(सुबह|दोपहर|शाम|रात)?\s*(\d{1,2})(?::(\d{2}))?\s*बजे\s*(सुबह|दोपहर|शाम|रात)?/g
  )) {
    add(
      normalizeTimeParts(
        Number(match[2]),
        Number(match[3] || 0),
        match[1] || match[4]
      )
    );
  }

  return found;
}

interface FrequencyMatch {
  label: string;
  count: number | null;
}

function countFromDosePattern(text: string): FrequencyMatch | null {
  DOSE_PATTERN_REGEX.lastIndex = 0;
  const match = DOSE_PATTERN_REGEX.exec(text);

  if (!match) return null;

  const parts = match[1].split(/[-+]/).map((part) => Number(part.trim()));
  const count = parts.filter((part) => part > 0).length;

  if (count < 1) return null;

  return {
    label:
      count === 1
        ? 'Once Daily'
        : count === 2
          ? 'Twice Daily'
          : count === 3
            ? 'Thrice Daily'
            : 'Four Times Daily',
    count,
  };
}

function extractFrequency(text: string): FrequencyMatch | null {
  const lower = text.toLowerCase();

  const rules: { label: string; pattern: RegExp; count: number }[] = [
    {
      label: 'Four Times Daily',
      pattern:
        /(?:^|[^a-z])(?:qid|q\.i\.d\.?)(?![a-z])|four\s+times\s+(?:a\s+)?(?:day|daily)|दिन\s*में\s*(?:4|चार)\s*बार|चार\s*बार/,
      count: 4,
    },
    {
      label: 'Thrice Daily',
      pattern:
        /(?:^|[^a-z])(?:tds|t\.d\.s\.?|tid)(?![a-z])|(?:three|3)\s*times\s+(?:a\s+)?(?:day|daily)|दिन\s*में\s*(?:3|तीन)\s*बार|तीन\s*बार/,
      count: 3,
    },
    {
      label: 'Twice Daily',
      pattern:
        /(?:^|[^a-z])(?:bd|b\.d\.?|bid)(?![a-z])|(?:two|2)\s*times\s+(?:a\s+)?(?:day|daily)|twice\s+(?:a\s+)?(?:day|daily)|दिन\s*में\s*(?:2|दो)\s*बार|दो\s*बार|सुबह\s*[-और,/]?\s*शाम/,
      count: 2,
    },
    {
      label: 'Once Daily',
      pattern:
        /(?:^|[^a-z])(?:od|o\.d\.?)(?![a-z])|once\s+(?:a\s+)?(?:day|daily)|(?:one|1)\s*time\s+(?:a\s+)?(?:day|daily)|दिन\s*में\s*(?:1|एक)\s*बार|एक\s*बार|प्रतिदिन|रोज|रोज़/,
      count: 1,
    },
    {
      label: 'At Bedtime',
      pattern:
        /(?:^|[^a-z])(?:hs|h\.s\.?)(?![a-z])|at\s+bedtime|bedtime|रात\s*को\s*सोते\s*समय/,
      count: 1,
    },
    {
      label: 'As Needed',
      pattern:
        /(?:^|[^a-z])(?:sos|s\.o\.s\.?|prn|p\.r\.n\.?)(?![a-z])|as\s+needed|जरूरत\s*पड़ने\s*पर|आवश्यकता\s*अनुसार/,
      count: 0,
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(lower)) {
      return { label: rule.label, count: rule.count };
    }
  }

  const everyHours = lower.match(
    /every\s+(\d+)\s*hours?|हर\s*(\d+)\s*घंटे/
  );

  if (everyHours) {
    const hours = Number(everyHours[1] || everyHours[2]);

    if (hours > 0 && hours <= 24) {
      return {
        label: `Every ${hours} Hours`,
        count: Math.max(1, Math.floor(24 / hours)),
      };
    }
  }

  const dosePattern = countFromDosePattern(text);
  if (dosePattern) return dosePattern;

  const periods: string[] = [];
  if (/सुबह|morning/i.test(text)) periods.push('Morning');
  if (/दोपहर|afternoon/i.test(text)) periods.push('Afternoon');
  if (/शाम|evening/i.test(text)) periods.push('Evening');
  if (/रात|night/i.test(text)) periods.push('Night');

  if (periods.length > 0) {
    return {
      label:
        periods.length === 1
          ? 'Once Daily'
          : periods.length === 2
            ? 'Twice Daily'
            : periods.length === 3
              ? 'Thrice Daily'
              : 'Four Times Daily',
      count: periods.length,
    };
  }

  return null;
}

function stripFrequency(text: string): string {
  return text
    .replace(
      /(?:^|[^a-z])(?:od|o\.d\.?|bd|b\.d\.?|bid|tds|t\.d\.s\.?|tid|qid|q\.i\.d\.?|hs|h\.s\.?|sos|s\.o\.s\.?|prn|p\.r\.n\.?)(?![a-z])/gi,
      ' '
    )
    .replace(/every\s+\d+\s*hours?/gi, ' ')
    .replace(/हर\s*\d+\s*घंटे/g, ' ');
}

interface TimingRule {
  label: string;
  pattern: RegExp;
}

const TIMING_RULES: TimingRule[] = [
  {
    label: 'After Breakfast',
    pattern:
      /after\s+breakfast|post\s+breakfast|breakfast\s+ke\s+baad|नाश्ते?\s*के\s*बाद|नाश्ते?\s*के\s*पश्चात/,
  },
  {
    label: 'After Lunch',
    pattern:
      /after\s+lunch|post\s+lunch|lunch\s+ke\s+baad|दोपहर\s*के\s*(?:भोजन\s*)?बाद|लंच\s*के\s*बाद/,
  },
  {
    label: 'After Dinner',
    pattern:
      /after\s+dinner|post\s+dinner|dinner\s+ke\s+baad|रात\s*के\s*(?:खाने|भोजन)\s*के\s*बाद|डिनर\s*के\s*बाद/,
  },
  {
    label: 'Before Breakfast',
    pattern:
      /before\s+breakfast|pre\s+breakfast|नाश्ते?\s*से\s*पहले|नाश्ते?\s*के\s*पूर्व/,
  },
  {
    label: 'Before Lunch',
    pattern:
      /before\s+lunch|pre\s+lunch|दोपहर\s*के\s*(?:भोजन\s*)?(?:से\s*पहले|पूर्व)|लंच\s*से\s*पहले/,
  },
  {
    label: 'Before Dinner',
    pattern:
      /before\s+dinner|pre\s+dinner|रात\s*के\s*(?:खाने|भोजन)\s*से\s*पहले|डिनर\s*से\s*पहले/,
  },
  {
    label: 'After Food',
    pattern:
      /(?:^|[^a-z])(?:pc|p\.c\.?)(?![a-z])|after\s+(?:food|meals?)|post\s+(?:meal|food)|खाने\s*के\s*बाद|भोजन\s*के\s*बाद|भोजनोपरांत|भोजन\s*के\s*पश्चात/,
  },
  {
    label: 'Before Food',
    pattern:
      /(?:^|[^a-z])(?:ac|a\.c\.?)(?![a-z])|before\s+(?:food|meals?)|pre\s+(?:meal|food)|खाने\s*से\s*पहले|भोजन\s*से\s*पहले|भोजन\s*के\s*पूर्व/,
  },
  {
    label: 'With Food',
    pattern:
      /with\s+(?:food|meals?)|भोजन\s*के\s*साथ|खाने\s*के\s*साथ/,
  },
  {
    label: 'Empty Stomach',
    pattern:
      /empty\s+stomach|खाली\s*पेट|भूखे\s*पेट/,
  },
];

function extractTiming(text: string): string {
  const specific = TIMING_RULES.slice(0, 6)
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.label);

  if (specific.length > 0) {
    return Array.from(new Set(specific)).join(' · ');
  }

  const general = TIMING_RULES.slice(6)
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.label);

  if (general.length > 0) {
    return Array.from(new Set(general)).join(' · ');
  }

  const periods: string[] = [];
  if (/सुबह|morning/i.test(text)) periods.push('Morning');
  if (/दोपहर|afternoon/i.test(text)) periods.push('Afternoon');
  if (/शाम|evening/i.test(text)) periods.push('Evening');
  if (/रात|night/i.test(text)) periods.push('Night');

  return Array.from(new Set(periods)).join(' & ');
}

function stripTiming(text: string): string {
  let result = text;

  for (const rule of TIMING_RULES) {
    result = result.replace(
      new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`),
      ' '
    );
  }

  return result;
}

const INSTRUCTION_RULES: TimingRule[] = [
  {
    label: 'Take with plenty of water',
    pattern: /plenty\s+of\s+water|भरपूर\s*पानी/,
  },
  {
    label: 'Take with water',
    pattern: /with\s+(?:a\s+glass\s+of\s+)?water|पानी\s*के\s*साथ/,
  },
  {
    label: 'Do not crush or chew',
    pattern: /do\s+not\s+(?:crush|chew)|न\s*चबाएं|चबाना\s*नहीं/,
  },
  {
    label: 'Chew thoroughly',
    pattern: /\bchew\b|चबाएं/,
  },
  {
    label: 'Swallow whole',
    pattern: /swallow\s+whole|पूरा\s*निगलें/,
  },
  {
    label: 'Complete the course',
    pattern: /complete\s+the\s+(?:full\s+)?course|पूरा\s*कोर्स/,
  },
  {
    label: 'Avoid alcohol',
    pattern: /avoid\s+alcohol|शराब\s*से\s*बचें/,
  },
  {
    label: 'Do not take on an empty stomach',
    pattern: /do\s+not\s+take\s+on\s+an?\s+empty\s+stomach/,
  },
  {
    label: 'Shake well before use',
    pattern: /shake\s+well|अच्छी\s*तरह\s*हिलाएं/,
  },
  {
    label: 'Gargle',
    pattern: /\bgargle\b|गरारा/,
  },
  {
    label: 'Inhale',
    pattern: /\binhale\b|भाप/,
  },
  {
    label: 'Apply as directed',
    pattern: /\bapply\b|लगाएं/,
  },
  {
    label: 'As directed',
    pattern: /as\s+directed|निर्देशानुसार/,
  },
];

function extractInstructions(text: string): string {
  return Array.from(
    new Set(
      INSTRUCTION_RULES.filter((rule) => rule.pattern.test(text)).map(
        (rule) => rule.label
      )
    )
  ).join(' · ');
}

function stripInstructions(text: string): string {
  let result = text;

  for (const rule of INSTRUCTION_RULES) {
    result = result.replace(
      new RegExp(rule.pattern.source, `${rule.pattern.flags.replace('g', '')}g`),
      ' '
    );
  }

  return result;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200) return null;
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatIsoDate(date);
}

function normalizeYear(value: number): number {
  if (value >= 100) return value;
  return value >= 50 ? 1900 + value : 2000 + value;
}

function lookupMonth(token: string): number | undefined {
  return MONTHS[token.toLowerCase().replace(/[.,]/g, '').trim()];
}

function parseDateToken(value: string): string | null {
  const text = normalizePrescriptionText(value)
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const monthNameFirst = text.match(
    new RegExp(`^(\\d{1,2})\\s+(${MONTH_TOKEN})[a-z\\u0900-\\u097F]*\\.?,?\\s+(\\d{2,4})$`, 'i')
  );

  if (monthNameFirst) {
    const month = lookupMonth(monthNameFirst[2]);
    if (month === undefined) return null;
    return buildDate(
      normalizeYear(Number(monthNameFirst[3])),
      month,
      Number(monthNameFirst[1])
    );
  }

  const monthFirst = text.match(
    new RegExp(`^(${MONTH_TOKEN})[a-z\\u0900-\\u097F]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{2,4})$`, 'i')
  );

  if (monthFirst) {
    const month = lookupMonth(monthFirst[1]);
    if (month === undefined) return null;
    return buildDate(
      normalizeYear(Number(monthFirst[3])),
      month,
      Number(monthFirst[2])
    );
  }

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return buildDate(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3])
    );
  }

  const numeric = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = normalizeYear(Number(numeric[3]));

    const day = first;
    const month = second - 1;

    return buildDate(year, month, day);
  }

  return null;
}

export function normalizeDateInput(value: string): string | null {
  const trimmed = (value || '').trim();

  if (!trimmed) return null;

  return parseDateToken(trimmed);
}

function extractDateNear(
  text: string,
  pattern: RegExp,
  reversePattern?: RegExp
): string | null {
  const direct = text.match(pattern);

  if (direct) {
    const date = parseDateToken(direct[1]);
    if (date) return date;
  }

  if (reversePattern) {
    const reversed = text.match(reversePattern);
    if (reversed) {
      const date = parseDateToken(reversed[1]);
      if (date) return date;
    }
  }

  return null;
}

function extractStartDate(text: string): string | null {
  if (/(?:from|starting)\s+today|आज\s*से|आज\s*से\s*शुरू/i.test(text)) {
    return formatIsoDate(new Date());
  }

  return extractDateNear(
    text,
    new RegExp(
      `(?:start(?:ing)?(?:\\s+date)?|from|प्रारंभ|शुरू)\\s*[:\\-]?\\s*(${DATE_TOKEN})`,
      'i'
    ),
    new RegExp(`(${DATE_TOKEN})\\s*(?:से|से\\s*शुरू)`, 'i')
  );
}

function extractEndDate(text: string): string | null {
  return extractDateNear(
    text,
    new RegExp(
      `(?:till|until|upto|up\\s+to|end(?:s)?(?:\\s+date)?|समाप्त|अंत)\\s*[:\\-]?\\s*(${DATE_TOKEN})`,
      'i'
    ),
    new RegExp(`(${DATE_TOKEN})\\s*तक`, 'i')
  );
}

export function parseDurationText(value: string): {
  value: number;
  unit: DurationUnit;
  text: string;
} | null {
  const text = normalizePrescriptionText(value);
  DURATION_REGEX.lastIndex = 0;

  const match = DURATION_REGEX.exec(text);

  if (!match) return null;

  const rawNumber = match[1].toLowerCase();
  const rawUnit = match[2].toLowerCase();

  const amount =
    NUMBER_WORDS[rawNumber] ?? Number(rawNumber.replace(/[^\d]/g, ''));

  if (!Number.isFinite(amount) || amount <= 0) return null;

  let unit: DurationUnit;

  if (/^(?:day|days|दिन)$/.test(rawUnit)) {
    unit = 'day';
  } else if (/^(?:week|weeks|wk|wks|सप्ताह|हफ्ते|हफ़्ते)$/.test(rawUnit)) {
    unit = 'week';
  } else if (/^(?:month|months|mo|mos|महीने|माह)$/.test(rawUnit)) {
    unit = 'month';
  } else {
    return null;
  }

  return {
    value: amount,
    unit,
    text: `${amount} ${unit}${amount === 1 ? '' : 's'}`,
  };
}

export function addDurationToDate(
  startDate: string,
  value: number,
  unit: DurationUnit
): string | null {
  const start = normalizeDateInput(startDate);

  if (!start || value <= 0) return null;

  const [year, month, day] = start.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (unit === 'day') {
    date.setDate(date.getDate() + value - 1);
  } else if (unit === 'week') {
    date.setDate(date.getDate() + value * 7 - 1);
  } else {
    date.setMonth(date.getMonth() + value);
    date.setDate(date.getDate() - 1);
  }

  return formatIsoDate(date);
}

function stripListPrefix(line: string): string {
  return line
    .replace(
      /^\s*(?:\(?\d{1,2}\)?\s*[.)\-:]\s+|[•*]\s+|[ivx]{1,4}[.)]\s+)/i,
      ''
    )
    .trim();
}

function isHeaderLine(line: string): boolean {
  return HEADER_REGEX.test(line) || HINDI_HEADER_REGEX.test(line);
}

function isInstructionLine(line: string): boolean {
  return INSTRUCTION_START_REGEX.test(line);
}

function isDateOnlyLine(line: string): boolean {
  return normalizeDateInput(line) !== null;
}

function isDateMetadataLine(line: string): boolean {
  return DATE_METADATA_REGEX.test(line);
}

function hasUsefulLetters(value: string): boolean {
  return /[A-Za-z\u0900-\u097F]/.test(value);
}

function cleanNameCandidate(line: string): string {
  let value = stripListPrefix(line);

  value = value.replace(FIELD_LABEL_REGEX, ' ');
  value = value.replace(/\b(?:rx|sig|signa)\b\.?/gi, ' ');
  value = value.replace(FORM_PREFIX_REGEX, ' ');
  value = stripDosage(value);
  value = stripTimes(value);
  value = value.replace(DOSE_PATTERN_REGEX, ' ');
  value = stripFrequency(value);
  value = stripTiming(value);
  value = stripInstructions(value);
  value = value.replace(DURATION_REGEX, ' ');
  value = value.replace(new RegExp(DATE_TOKEN, 'gi'), ' ');
  value = value.replace(STOP_WORDS, ' ');
  value = stripHindiStopWords(value);
  value = value.replace(/[^A-Za-z\u0900-\u097F0-9\s+&/-]/g, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  value = value.replace(/^[\s.,;:\-–—/]+|[\s.,;:\-–—/]+$/g, '');
  value = value.replace(/\s{2,}/g, ' ').trim();

  if (!value || !hasUsefulLetters(value)) return '';
  if (value.length < 2 || value.length > 70) return '';
  if (isHeaderLine(value) || isInstructionLine(value)) return '';
  if (isDateOnlyLine(value)) return '';
  if (findDosage(value)) return '';
  if (extractFrequency(value)) return '';
  if (extractTimes(value).length > 0) return '';

  return value;
}

function looksLikeNewMedicine(line: string, block: string[]): boolean {
  if (!findDosage(line)) return false;
  if (isInstructionLine(line)) return false;

  const candidate = cleanNameCandidate(line);

  if (!candidate) return false;
  if (block.length === 0) return true;

  return true;
}

function nextLineHasDosage(lines: string[], index: number): boolean {
  for (let next = index + 1; next < Math.min(lines.length, index + 3); next += 1) {
    const line = stripListPrefix(lines[next]);

    if (!line) continue;
    if (isHeaderLine(line)) return false;
    if (findDosage(line)) return true;
    if (!isInstructionLine(line) && !isDateOnlyLine(line)) return false;
  }

  return false;
}

function buildMedicineBlocks(text: string): string[][] {
  const lines = normalizePrescriptionText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: string[][] = [];
  let current: string[] | null = null;

  const flush = () => {
    if (current && current.length > 0) {
      blocks.push(current);
    }
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const numbered = /^\s*\(?\d{1,2}\)?\s*[.)\-:]\s+/.test(rawLine);
    const bullet = /^\s*[•*]\s+/.test(rawLine);
    const line = stripListPrefix(rawLine);

    if (!line) continue;
    if (isDateMetadataLine(line)) continue;

    const dosage = findDosage(line);

    if (numbered || bullet) {
      flush();
      current = [line];
      continue;
    }

    if (!current) {
      if (dosage) {
        current = [line];
        continue;
      }

      if (
        !isHeaderLine(line) &&
        !isInstructionLine(line) &&
        !isDateOnlyLine(line) &&
        nextLineHasDosage(lines, index) &&
        cleanNameCandidate(line)
      ) {
        current = [line];
      }

      continue;
    }

    if (isHeaderLine(line) && !dosage) {
      flush();
      continue;
    }

    if (dosage && !isInstructionLine(line) && looksLikeNewMedicine(line, current)) {
      flush();
      current = [line];
      continue;
    }

    if (
      dosage ||
      isInstructionLine(line) ||
      isDateOnlyLine(line) ||
      extractFrequency(line) ||
      extractTiming(line) ||
      extractTimes(line).length > 0 ||
      parseDurationText(line) ||
      current.length < 3
    ) {
      current.push(line);
      continue;
    }

    if (cleanNameCandidate(line)) {
      flush();
      current = [line];
      continue;
    }

    current.push(line);
  }

  flush();

  return blocks;
}

function extractQuantity(text: string): number {
  const match = text.match(
    /(\d+)\s*(?:tablets?|tabs?|capsules?|caps?|गोली|टैबलेट|कैप्सूल)/i
  );

  if (match) {
    const quantity = Number(match[1]);
    if (Number.isFinite(quantity) && quantity > 0 && quantity <= 20) {
      return quantity;
    }
  }

  return 1;
}

function buildWarnings(medicine: {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  schedules: ParsedSchedule[];
  startDate: string;
  endDate: string;
  durationText: string;
}): string[] {
  const warnings: string[] = [];

  if (!medicine.name.trim()) {
    warnings.push('Medicine name not found. Enter it before adding.');
  }

  if (!medicine.dosage.trim()) {
    warnings.push('Dosage not found. Enter it before adding.');
  }

  if (!medicine.timing.trim()) {
    warnings.push('Food timing was not found. Enter timing before adding.');
  }

  if (!medicine.frequency.trim()) {
    warnings.push('Frequency was not found. Confirm it before adding.');
  }

  if (medicine.schedules.length === 0) {
    warnings.push('Dose time was not found. Add at least one time before adding.');
  }

  if (medicine.durationText && !medicine.startDate) {
    warnings.push(
      'Start date was not found, so the end date cannot be calculated. Enter a start date.'
    );
  }

  if (
    medicine.startDate &&
    medicine.endDate &&
    medicine.endDate < medicine.startDate
  ) {
    warnings.push('End date is before the start date. Check the dates.');
  }

  return warnings;
}

function parseBlock(
  block: string[],
  defaultStartDate = '',
  defaultEndDate = ''
): ParsedPrescriptionMedicine | null {
  const rawText = block.join(' ').replace(/\s+/g, ' ').trim();

  if (!rawText) return null;

  const dosageMatch = findDosage(rawText);
  const dosage = dosageMatch?.dosage || '';

  let name = '';

  for (const line of block) {
    const candidate = cleanNameCandidate(line);
    if (candidate) {
      name = candidate;
      break;
    }
  }

  if (!name) return null;

  const frequencyMatch = extractFrequency(rawText);
  const frequency = frequencyMatch?.label || '';
  const timing = extractTiming(rawText);
  const instructions = extractInstructions(rawText);
  const times = extractTimes(rawText);
  const quantity = extractQuantity(rawText);
  const duration = parseDurationText(rawText);

  const startDate = extractStartDate(rawText) || defaultStartDate;
  let endDate = extractEndDate(rawText) || defaultEndDate;

  if (!endDate && startDate && duration) {
    endDate =
      addDurationToDate(startDate, duration.value, duration.unit) || '';
  }

  const schedules = times.map((time) => ({
    time,
    quantity,
  }));

  const warnings = buildWarnings({
    name,
    dosage,
    frequency,
    timing,
    schedules,
    startDate,
    endDate,
    durationText: duration?.text || '',
  });

  if (
    frequencyMatch &&
    frequencyMatch.count !== null &&
    frequencyMatch.count > 0 &&
    times.length > 0
  ) {
    if (times.length !== frequencyMatch.count) {
      warnings.push(
        `Frequency says ${frequencyMatch.label}, but ${times.length} dose time${
          times.length === 1 ? '' : 's'
        } were found. Confirm the schedule.`
      );
    }
  }

  return {
    name,
    dosage,
    frequency,
    timing,
    instructions,
    schedules,
    startDate,
    endDate,
    durationText: duration?.text || '',
    durationValue: duration?.value ?? null,
    durationUnit: duration?.unit ?? null,
    rawText,
    warnings,
  };
}

function medicineIdentity(medicine: ParsedPrescriptionMedicine): string {
  return `${medicine.name.toLowerCase().replace(/\s+/g, ' ')}::${medicine.dosage
    .toLowerCase()
    .replace(/\s+/g, '')}`;
}

function mergeMedicine(
  target: ParsedPrescriptionMedicine,
  source: ParsedPrescriptionMedicine
): ParsedPrescriptionMedicine {
  const schedules = [...target.schedules];

  for (const schedule of source.schedules) {
    if (!schedules.some((item) => item.time === schedule.time)) {
      schedules.push(schedule);
    }
  }

  const merged: ParsedPrescriptionMedicine = {
    ...target,
    dosage: target.dosage || source.dosage,
    frequency: target.frequency || source.frequency,
    timing: target.timing || source.timing,
    instructions: target.instructions || source.instructions,
    schedules,
    startDate: target.startDate || source.startDate,
    endDate: target.endDate || source.endDate,
    durationText: target.durationText || source.durationText,
    durationValue: target.durationValue ?? source.durationValue,
    durationUnit: target.durationUnit ?? source.durationUnit,
    warnings: [],
  };

  merged.warnings = buildWarnings({
    name: merged.name,
    dosage: merged.dosage,
    frequency: merged.frequency,
    timing: merged.timing,
    schedules: merged.schedules,
    startDate: merged.startDate,
    endDate: merged.endDate,
    durationText: merged.durationText,
  });

  const frequencyMatch = extractFrequency(
    `${target.rawText} ${source.rawText}`
  );

  if (
    frequencyMatch?.count !== null &&
    frequencyMatch?.count !== undefined &&
    frequencyMatch.count > 0 &&
    merged.schedules.length > 0 &&
    merged.schedules.length !== frequencyMatch.count
  ) {
    merged.warnings.push(
      `Frequency says ${frequencyMatch.label}, but ${merged.schedules.length} dose time${
        merged.schedules.length === 1 ? '' : 's'
      } were found. Confirm the schedule.`
    );
  }

  return merged;
}

export function parsePrescriptionMedicines(
  text: string
): ParsedPrescriptionMedicine[] {
  const blocks = buildMedicineBlocks(text);
  const parsed: ParsedPrescriptionMedicine[] = [];
  const defaultStartDate = extractStartDate(text) || '';
  const defaultEndDate = extractEndDate(text) || '';

  for (const block of blocks) {
    const medicine = parseBlock(block, defaultStartDate, defaultEndDate);

    if (!medicine) continue;

    const existing = parsed.find(
      (item) => medicineIdentity(item) === medicineIdentity(medicine)
    );

    if (existing) {
      const index = parsed.indexOf(existing);
      parsed[index] = mergeMedicine(existing, medicine);
    } else {
      parsed.push(medicine);
    }
  }

  return parsed;
}
