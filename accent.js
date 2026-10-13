(function initRussianStress(global) {
  "use strict";

  const ACUTE = "\u0301";
  const VOWELS = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";
  // Include an existing combining acute so a stressed word is one token.
  const WORD_RE = /[А-Яа-яЁё\u0301]+(?:-[А-Яа-яЁё\u0301]+)*/g;
  const OVERRIDE_DICTIONARY = {
    "украина": "украи́на",
    "украине": "украи́не",
    "украину": "украи́ну",
    "украиной": "украи́ной",
    "украиною": "украи́ною",
    "украины": "украи́ны",
    "украинец": "украи́нец",
    "украинца": "украи́нца",
    "украинцем": "украи́нцем",
    "украинцу": "украи́нцу",
    "украинцы": "украи́нцы",
    "украинцев": "украи́нцев",
    "украинцам": "украи́нцам",
    "украинцами": "украи́нцами",
    "украинцах": "украи́нцах",
    "украинский": "украи́нский",
    "украинская": "украи́нская",
    "украинское": "украи́нское",
    "украинские": "украи́нские",
    "украинского": "украи́нского",
    "украинской": "украи́нской",
    "украинскому": "украи́нскому",
    "украинском": "украи́нском",
    "украинскую": "украи́нскую",
    "украинским": "украи́нским",
    "украинскими": "украи́нскими",
    "украинских": "украи́нских",

    // Metric and quantitative units (cleans false adjective-short-form collisions like -о́в)
    "килограммов": "килогра́ммов",
    "километров": "киломе́тров",
    "миллиметров": "миллиме́тров",
    "метров": "ме́тров",
    "литров": "ли́тров",
    "минут": "мину́т",
    "дюймов": "дю́ймов",

    // High-frequency nouns with bogus -о́в / adjective collisions
    "мальчиков": "ма́льчиков",
    "продуктов": "проду́ктов",
    "рисков": "ри́сков",
    "подростков": "подро́стков",
    "оркестров": "орке́стров",
    "комплексов": "ко́мплексов",
    "кредитов": "креди́тов",
    "участков": "уча́стков",
    "секторов": "се́кторов",
    "ректоров": "ре́кторов",
    "тигров": "ти́гров",
    "прожекторов": "проже́кторов",
    "рупоров": "ру́поров",
    "вымпелов": "вы́мпелов",
    "буферов": "бу́феров",
    "кедров": "ке́дров",
    "лавров": "ла́вров",
    "ужинов": "у́жинов",
    "поисков": "по́исков",
    "пикников": "пикнико́в",
    "парников": "парнико́в",
    "тупиков": "тупико́в",
    "апартамент": "апартаме́нт",
    "апартаменты": "апартаме́нты",
    "апартаментов": "апартаме́нтов",

    // High-frequency nouns shadowed by archaic/verb collisions
    "случай": "слу́чай",
    "случаю": "слу́чаю",
    "случаем": "слу́чаем",
    "звонок": "звоно́к"
  };
  let stressData = null;
  let stressDataPromise = null;

  const BASE_DICTIONARY = {
    "а": "а",
    "август": "а́вгуст",
    "автор": "а́втор",
    "адрес": "а́дрес",
    "адреса": "адреса́",
    "активный": "акти́вный",
    "анализ": "ана́лиз",
    "апрель": "апре́ль",
    "база": "ба́за",
    "банк": "банк",
    "без": "без",
    "безопасность": "безопа́сность",
    "берег": "бе́рег",
    "бизнес": "би́знес",
    "благодарю": "благодарю́",
    "большой": "большо́й",
    "больше": "бо́льше",
    "будет": "бу́дет",
    "буду": "бу́ду",
    "будут": "бу́дут",
    "бы": "бы",
    "быстро": "бы́стро",
    "важно": "ва́жно",
    "важный": "ва́жный",
    "ваш": "ваш",
    "ваша": "ва́ша",
    "ваше": "ва́ше",
    "ввести": "ввести́",
    "везде": "везде́",
    "верно": "ве́рно",
    "вернуться": "верну́ться",
    "весна": "весна́",
    "вечер": "ве́чер",
    "взгляд": "взгляд",
    "видеть": "ви́деть",
    "вместе": "вме́сте",
    "внимание": "внима́ние",
    "внутри": "внутри́",
    "вопрос": "вопро́с",
    "вопросы": "вопро́сы",
    "воскресенье": "воскресе́нье",
    "время": "вре́мя",
    "все": "все",
    "всем": "всем",
    "всё": "всё",
    "встреча": "встре́ча",
    "вторник": "вто́рник",
    "вчера": "вчера́",
    "вы": "вы",
    "выбрать": "вы́брать",
    "выбор": "вы́бор",
    "выполнить": "вы́полнить",
    "где": "где",
    "год": "год",
    "года": "го́да",
    "готов": "гото́в",
    "готова": "гото́ва",
    "готово": "гото́во",
    "говорить": "говори́ть",
    "город": "го́род",
    "группа": "гру́ппа",
    "да": "да",
    "далее": "да́лее",
    "данные": "да́нные",
    "дата": "да́та",
    "день": "день",
    "деньги": "де́ньги",
    "декабрь": "дека́брь",
    "дела": "дела́",
    "делать": "де́лать",
    "для": "для",
    "до": "до",
    "доброе": "до́брое",
    "договор": "догово́р",
    "документ": "докуме́нт",
    "документы": "докуме́нты",
    "дом": "дом",
    "дома": "до́ма",
    "дорога": "доро́га",
    "друг": "друг",
    "друзья": "друзья́",
    "думать": "ду́мать",
    "еще": "ещё",
    "ещё": "ещё",
    "ждать": "ждать",
    "жизнь": "жизнь",
    "завтра": "за́втра",
    "задача": "зада́ча",
    "звонок": "звоно́к",
    "здравствуйте": "здра́вствуйте",
    "здесь": "здесь",
    "зима": "зима́",
    "знать": "знать",
    "значит": "зна́чит",
    "и": "и",
    "июль": "ию́ль",
    "июнь": "ию́нь",
    "имя": "и́мя",
    "информация": "информа́ция",
    "использовать": "испо́льзовать",
    "исправить": "испра́вить",
    "итог": "ито́г",
    "как": "как",
    "календарь": "календа́рь",
    "команда": "кома́нда",
    "компания": "компа́ния",
    "конец": "коне́ц",
    "контакт": "конта́кт",
    "конечно": "коне́чно",
    "коротко": "ко́ротко",
    "который": "кото́рый",
    "кто": "кто",
    "куда": "куда́",
    "лето": "ле́то",
    "лучше": "лу́чше",
    "люблю": "люблю́",
    "май": "май",
    "март": "март",
    "место": "ме́сто",
    "месяц": "ме́сяц",
    "минут": "мину́т",
    "минута": "мину́та",
    "мне": "мне",
    "могу": "могу́",
    "может": "мо́жет",
    "можно": "мо́жно",
    "мой": "мой",
    "москва": "Москва́",
    "мы": "мы",
    "на": "на",
    "написать": "написа́ть",
    "настройка": "настро́йка",
    "неделя": "неде́ля",
    "нельзя": "нельзя́",
    "нет": "нет",
    "новый": "но́вый",
    "нужно": "ну́жно",
    "обед": "обе́д",
    "обновить": "обнови́ть",
    "один": "оди́н",
    "октябрь": "октя́брь",
    "он": "он",
    "она": "она́",
    "они": "они́",
    "оно": "оно́",
    "ответ": "отве́т",
    "ответить": "отве́тить",
    "отправить": "отпра́вить",
    "очень": "о́чень",
    "ошибка": "оши́бка",
    "письмо": "письмо́",
    "письма": "пи́сьма",
    "план": "план",
    "плохо": "пло́хо",
    "по": "по",
    "поддержка": "подде́ржка",
    "позже": "по́зже",
    "понедельник": "понеде́льник",
    "понять": "поня́ть",
    "пожалуйста": "пожа́луйста",
    "почему": "почему́",
    "правильно": "пра́вильно",
    "привет": "приве́т",
    "пример": "приме́р",
    "проверить": "прове́рить",
    "проект": "прое́кт",
    "просто": "про́сто",
    "пятница": "пя́тница",
    "работа": "рабо́та",
    "работать": "рабо́тать",
    "раз": "раз",
    "результат": "результа́т",
    "решение": "реше́ние",
    "решить": "реши́ть",
    "россия": "Росси́я",
    "русский": "ру́сский",
    "сайт": "сайт",
    "сам": "сам",
    "самый": "са́мый",
    "сегодня": "сего́дня",
    "сейчас": "сейча́с",
    "сентябрь": "сентя́брь",
    "сказать": "сказа́ть",
    "скоро": "ско́ро",
    "слово": "сло́во",
    "случай": "слу́чай",
    "смотреть": "смотре́ть",
    "сообщение": "сообще́ние",
    "спасибо": "спаси́бо",
    "среда": "среда́",
    "срок": "срок",
    "суббота": "суббо́та",
    "текст": "текст",
    "тема": "те́ма",
    "тест": "тест",
    "тогда": "тогда́",
    "только": "то́лько",
    "точно": "то́чно",
    "удобно": "удо́бно",
    "уже": "уже́",
    "утро": "у́тро",
    "файл": "файл",
    "февраль": "февра́ль",
    "хорошо": "хорошо́",
    "хочу": "хочу́",
    "четверг": "четве́рг",
    "что": "что",
    "чтобы": "что́бы",
    "школа": "шко́ла",
    "это": "э́то",
    "январь": "янва́рь"
  };

  function stripStress(text) {
    return String(text || "").normalize("NFC").replace(new RegExp(ACUTE, "g"), "");
  }

  function hasStress(text) {
    return String(text || "").includes(ACUTE) || /ё/i.test(text);
  }

  // ё is always stressed. An acute on ё, or two acutes in a row, is a bad form.
  function sanitizeStress(text) {
    return String(text || "")
      .replace(/([ёЁ])\u0301+/g, "$1")
      .replace(/\u0301{2,}/g, "\u0301");
  }

  function sameBaseLetter(source, output) {
    if (source === output) return true;
    const sourceLower = source.toLocaleLowerCase("ru-RU");
    const outputLower = output.toLocaleLowerCase("ru-RU");
    return (sourceLower === "е" && outputLower === "ё") || (sourceLower === "ё" && outputLower === "е");
  }

  function alignStress(original, accented) {
    const source = Array.from(original);
    const output = Array.from(accented);
    const pieces = new Array(source.length);
    let index = 0;
    for (let i = 0; i < source.length; i += 1) {
      if (index >= output.length || !sameBaseLetter(source[i], output[index])) return null;
      let chunk = output[index];
      index += 1;
      while (index < output.length && output[index] === ACUTE) {
        chunk += output[index];
        index += 1;
      }
      pieces[i] = chunk;
    }
    if (index !== output.length) return null;
    return pieces;
  }

  function countVowels(text) {
    return Array.from(text).filter((char) => VOWELS.includes(char)).length;
  }

  function normalizeKey(word) {
    return stripStress(word).toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  }

  function firstVowelStressed(word) {
    const chars = Array.from(word);
    const index = chars.findIndex((char) => VOWELS.includes(char));
    if (index === -1) return word;
    chars.splice(index + 1, 0, ACUTE);
    return chars.join("");
  }

  function applyCase(source, accented) {
    if (!source || !accented) return accented;
    if (source.toLocaleUpperCase("ru-RU") === source) {
      return accented.toLocaleUpperCase("ru-RU");
    }
    const srcChars = Array.from(source);
    const accChars = Array.from(accented);
    let srcIndex = 0;
    const result = [];
    for (let i = 0; i < accChars.length; i += 1) {
      const char = accChars[i];
      if (char === ACUTE) {
        result.push(char);
      } else if (srcIndex < srcChars.length) {
        const srcChar = srcChars[srcIndex];
        srcIndex += 1;
        if (srcChar.toLocaleUpperCase("ru-RU") === srcChar && srcChar.toLocaleLowerCase("ru-RU") !== srcChar) {
          result.push(char.toLocaleUpperCase("ru-RU"));
        } else {
          result.push(char.toLocaleLowerCase("ru-RU"));
        }
      } else {
        result.push(char);
      }
    }
    return result.join("");
  }

  function buildDictionary(customEntries) {
    const dictionary = { ...BASE_DICTIONARY };
    Object.entries(stressData || global.RussianStressData || {}).forEach(([key, value]) => {
      if (key && value) dictionary[key] = value;
    });
    Object.entries(OVERRIDE_DICTIONARY).forEach(([key, value]) => {
      dictionary[key] = value;
    });
    Object.entries(customEntries || {}).forEach(([key, value]) => {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey && value) dictionary[normalizedKey] = value;
    });
    return dictionary;
  }

  function getDictionaryEntry(key, customEntries) {
    const custom = customEntries?.[key];
    if (custom) return custom;
    if (OVERRIDE_DICTIONARY[key]) return OVERRIDE_DICTIONARY[key];
    const data = stressData || global.RussianStressData || {};
    return data[key] || BASE_DICTIONARY[key];
  }

  function presentForms(entry, sourceWord) {
    if (!entry) return [];
    const rawForms = Array.isArray(entry) ? entry : [entry];
    const plain = stripStress(sourceWord);
    const forms = [];
    rawForms.forEach((form) => {
      if (!form) return;
      const presented = sanitizeStress(applyCase(plain, form));
      if (presented && !forms.includes(presented)) forms.push(presented);
    });
    return forms;
  }

  function resolvePresented(entry, sourceWord, options) {
    const forms = presentForms(entry, sourceWord);
    if (forms.length === 1) return forms[0];
    if (forms.length > 1 && options?.ambiguous === "first") return forms[0];
    return null;
  }

  function stressWord(word, dictionaryOrCustomEntries, options) {
    if (!word) return word;
    const sanitized = sanitizeStress(word);
    if (hasStress(sanitized)) return sanitized;

    const plain = stripStress(sanitized);
    const customEntries = dictionaryOrCustomEntries || {};
    const direct = resolvePresented(getDictionaryEntry(normalizeKey(plain), customEntries), plain, options);
    if (direct) return direct;
    if (countVowels(plain) <= 1) return plain;
    return plain;
  }

  function stressText(text, customEntries, options) {
    return sanitizeStress(String(text || "").replace(WORD_RE, (word) => {
      const sanitized = sanitizeStress(word);
      if (hasStress(sanitized)) return sanitized;
      const whole = stressWord(sanitized, customEntries, options);
      if (whole !== sanitized) return whole;
      if (sanitized.includes("-")) {
        return sanitized.split("-").map((part) => stressWord(part, customEntries, options)).join("-");
      }
      return whole;
    }));
  }

  function splitAccented(parts, customEntries, options) {
    const list = Array.isArray(parts) ? parts.map((part) => String(part || "")) : [String(parts || "")];
    const original = list.join("");
    const accented = stressText(original, customEntries, options);
    if (accented === original) return { changed: false, parts: list.slice() };
    const pieces = alignStress(original, accented);
    if (!pieces) return null;
    const next = [];
    let index = 0;
    list.forEach((part) => {
      const count = Array.from(part).length;
      next.push(pieces.slice(index, index + count).join(""));
      index += count;
    });
    return { changed: next.some((part, partIndex) => part !== list[partIndex]), parts: next };
  }

  async function loadStressData() {
    if (stressData) return stressData;
    if (global.RussianStressData) {
      stressData = global.RussianStressData;
      return stressData;
    }
    if (!stressDataPromise) {
      const url = global.chrome?.runtime?.getURL ? global.chrome.runtime.getURL("stress-data.json") : "stress-data.json";
      stressDataPromise = fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Stress data load failed: ${response.status}`);
        return response.json();
      }).then((data) => {
        stressData = data;
        return stressData;
      }).catch((error) => {
        stressDataPromise = null;
        throw error;
      });
    }
    return stressDataPromise;
  }

  async function stressTextAsync(text, customEntries, options) {
    await loadStressData();
    return stressText(text, customEntries, options);
  }

  function lookupWord(word, customEntries) {
    const key = normalizeKey(word);
    const entry = getDictionaryEntry(key, customEntries || {});
    let forms = presentForms(entry, word);
    if (!forms.length && word.includes("-")) {
      const parts = word.split("-");
      const partResults = parts.map((part) => lookupWord(part, customEntries));
      if (partResults.some(Boolean)) {
        const joined = parts.map((part, index) => {
          const res = partResults[index];
          return res ? res.forms[0] : part;
        }).join("-");
        forms = [joined];
      }
    }
    if (!forms.length) return null;
    return {
      key,
      forms,
      ambiguous: forms.length > 1
    };
  }

  async function lookupWordAsync(word, customEntries) {
    await loadStressData();
    return lookupWord(word, customEntries);
  }

  function parseCustomDictionary(raw) {
    const result = {};
    String(raw || "").split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.includes("=>") ? "=>" : trimmed.includes("=") ? "=" : null;
      if (!separator) return;
      const parts = trimmed.split(separator);
      const key = stripStress(parts[0]).trim();
      const value = parts.slice(1).join(separator).trim();
      if (key && value) result[normalizeKey(key)] = sanitizeStress(value);
    });
    return result;
  }

  global.RussianStress = {
    ACUTE,
    BASE_DICTIONARY,
    buildDictionary,
    countVowels,
    firstVowelStressed,
    hasStress,
    loadStressData,
    lookupWord,
    lookupWordAsync,
    normalizeKey,
    parseCustomDictionary,
    sanitizeStress,
    splitAccented,
    stressText,
    stressTextAsync,
    stripStress
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
