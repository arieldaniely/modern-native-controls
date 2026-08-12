(() => {
  "use strict";

  const runtimeMarker = "data-mnc-date-runtime";
  if (document.documentElement.hasAttribute(runtimeMarker)) return;
  document.documentElement.setAttribute(runtimeMarker, "");

  let input = null;
  let viewYear = 0;
  let viewMonth = 0;
  let hebrewViewYear = 0;
  let hebrewViewMonth = "";
  let calendarMode = "gregorian";
  let locale = "he-IL";
  let direction = "rtl";
  let host;
  let shadow;
  let panel;
  let monthTrigger;
  let monthTriggerText;
  let monthMenu;
  let yearField;
  let hebrewRange;
  let searchField;
  let searchStatus;
  let modeButtons;
  let modeTimer;
  let weekdays;
  let days;

  const pad = number => String(number).padStart(2, "0");
  const iso = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const parse = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) return null;
    return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  };
  const today = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  };
  const addDays = (date, amount) => new Date(date.getTime() + amount * 86400000);
  const monthNumber = (year, month) => year * 12 + month;

  function ensurePicker() {
    if (host) return;
    host = document.createElement("div");
    host.id = "modern-native-date-picker";
    Object.assign(host.style, {
      all: "initial",
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none"
    });
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light dark; }
        * { box-sizing: border-box; }
        .panel {
          --accent: var(--mnc-site-accent, #0a7aff); --accent-strong: var(--mnc-site-accent-hover, #0068e6);
          --on-accent: var(--mnc-site-on-accent, #fff); --text: var(--mnc-site-text, #1d1d1f);
          --muted: var(--mnc-site-muted, #6e6e73); --surface: var(--mnc-site-surface, rgb(255 255 255 / 96%));
          --surface-solid: var(--mnc-site-surface-solid, #fff); --hover: var(--mnc-site-hover, #f2f7ff);
          --selected: var(--mnc-site-selected, #e6f1ff); --border: var(--mnc-site-border, rgb(0 0 0 / 10%));
          position: fixed; inline-size: min(17rem, calc(100vw - 16px));
          padding: .55rem; border: 1px solid var(--border); border-radius: .85rem;
          background: var(--surface); color: var(--text); backdrop-filter: blur(22px) saturate(1.25);
          box-shadow: 0 20px 50px var(--mnc-site-shadow, rgb(0 0 0 / 18%)), 0 3px 12px rgb(0 0 0 / 8%);
          font: 13px/1.25 system-ui, -apple-system, "Segoe UI", sans-serif;
          pointer-events: auto; user-select: none;
          animation: enter 120ms ease-out;
        }
        @keyframes enter { from { opacity: 0; transform: translateY(-4px) scale(.985); } }
        .head { display: grid; grid-template-columns: 1.8rem 1fr 1.8rem; align-items: center; gap: .2rem; }
        .modes { position: relative; isolation: isolate; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-block-end: .45rem; padding: 2px; border-radius: .5rem; background: color-mix(in srgb, var(--surface-solid) 82%, var(--text) 18%); }
        .modes::before { content: ""; position: absolute; z-index: -1; inset-block: 2px; inset-inline-start: 2px; inline-size: calc(50% - 3px); border-radius: .4rem; background: var(--surface-solid); box-shadow: 0 1px 4px rgb(0 0 0 / 14%); transition: inset-inline-start 220ms cubic-bezier(.2,.8,.2,1); }
        .panel.mode-hebrew .modes::before { inset-inline-start: calc(50% + 1px); }
        .modes button { position: relative; z-index: 1; block-size: 1.65rem; font-size: .72rem; font-weight: 650; color: var(--muted); transition: color 180ms ease; }
        .modes button[aria-pressed="true"] { color: var(--text); }
        .head, .weekdays, .days { transition: opacity 90ms ease, transform 110ms ease; transform-origin: 50% 40%; }
        .panel.mode-exit .head, .panel.mode-exit .weekdays, .panel.mode-exit .days { opacity: 0; transform: translateY(2px) scale(.992); }
        .panel.mode-enter .head, .panel.mode-enter .weekdays, .panel.mode-enter .days { animation: mode-enter 170ms cubic-bezier(.2,.8,.2,1); }
        @keyframes mode-enter { from { opacity: 0; transform: translateY(-2px) scale(.992); } to { opacity: 1; transform: none; } }
        .jump { display: grid; grid-template-columns: 1fr 4.25rem; gap: .25rem; }
        .month-picker { position: relative; min-inline-size: 0; }
        .month-trigger, .jump input, .search input {
          min-inline-size: 0; block-size: 1.8rem; padding: .25rem .4rem;
          border: 1px solid var(--border); border-radius: .45rem; background: var(--surface-solid);
          color: var(--text); font: inherit;
        }
        .month-trigger { display: flex; align-items: center; justify-content: space-between; gap: .35rem; inline-size: 100%; }
        .month-chevron {
          flex: 0 0 auto; inline-size: .78rem; block-size: .78rem;
          background: var(--muted); -webkit-mask: center / contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");
          mask: center / contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");
          transition: rotate 140ms ease;
        }
        .month-trigger[aria-expanded="true"] .month-chevron { rotate: 180deg; }
        .month-menu {
          position: absolute; z-index: 5; inset-block-start: calc(100% + .3rem); inset-inline-end: 0;
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px;
          inline-size: 11.5rem; max-inline-size: calc(100vw - 2rem); padding: .25rem;
          border: 1px solid var(--border); border-radius: .55rem;
          background: var(--surface); box-shadow: 0 12px 30px var(--mnc-site-shadow, rgb(0 0 0 / 18%));
          backdrop-filter: blur(18px);
        }
        .month-menu[hidden] { display: none; }
        .month-option { display: block; inline-size: 100%; min-block-size: 1.7rem; padding: .28rem .45rem; text-align: start; }
        .month-option:hover, .month-option:focus-visible { background: var(--hover); color: var(--accent-strong); }
        .month-option[aria-selected="true"] { background: var(--selected); color: var(--accent-strong); font-weight: 650; }
        .jump input { text-align: center; }
        .month-trigger:focus-visible, .jump input:focus-visible, .search input:focus-visible {
          outline: 0; border-color: var(--accent); box-shadow: 0 0 0 2px rgb(37 99 235 / 20%);
        }
        .hebrew-range { display: none; }
        button {
          border: 0; border-radius: .55rem; background: transparent; color: inherit;
          font: inherit; cursor: pointer;
        }
        button:focus-visible { outline: 0; box-shadow: 0 0 0 3px rgb(37 99 235 / 23%); }
        .nav { display: grid; place-items: center; inline-size: 1.8rem; block-size: 1.8rem; font-size: 1.05rem; }
        .nav:hover, .day:hover:not(:disabled), .footer button:hover { background: var(--hover); color: var(--accent); }
        .weekdays, .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: .15rem; }
        .search { display: block; inline-size: 6.2rem; margin: 0; }
        .search button, .search input { inline-size: 100%; block-size: 1.65rem; }
        .search button { padding-inline: .4rem; color: var(--accent); font-weight: 650; }
        .search input { display: none; padding: .2rem .38rem; }
        .panel.search-open .search button { display: none; }
        .panel.search-open .search input { display: block; }
        .search-status {
          display: none; position: absolute; inset-inline: .5rem; inset-block-end: 2.45rem;
          padding: .32rem .45rem; border: 1px solid #fecaca; border-radius: .4rem;
          background: #fff7f7; color: #b91c1c; font-size: .68rem; text-align: center;
          box-shadow: 0 4px 12px rgb(15 23 42 / 12%);
        }
        .search-status:not(:empty) { display: block; }
        .weekdays { margin-block: .25rem .1rem; color: var(--muted); font-size: .66rem; font-weight: 700; text-align: center; }
        .weekday { padding-block: .15rem; }
        .day { position: relative; aspect-ratio: 1.12; min-inline-size: 0; font-size: .76rem; }
        .day.other { color: var(--muted); opacity: .58; }
        .day.today::after { content: ""; position: absolute; inset-inline: 37%; inset-block-end: .22rem; block-size: 2px; border-radius: 2px; background: var(--accent); }
        .day.today { color: var(--accent-strong); font-weight: 700; }
        .day.today.selected::after { background: var(--on-accent); }
        .day.today.selected { color: var(--on-accent); }
        .day.selected { background: var(--accent); color: #fff; font-weight: 700; box-shadow: 0 2px 7px rgb(10 122 255 / 30%); }
        .day.selected:hover { background: var(--accent-strong); color: #fff; }
        .day:disabled { opacity: .3; cursor: not-allowed; }
        .footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: .3rem; margin-block-start: .35rem; padding-block-start: .35rem; border-block-start: 1px solid var(--border); }
        .footer button { padding: .28rem .45rem; color: var(--accent); font-weight: 650; }
        .footer > button:first-child { justify-self: start; }
        .footer > button:last-child { justify-self: end; }
        @media (prefers-color-scheme: dark) {
          .panel { --text: var(--mnc-site-text, #f5f5f7); --muted: var(--mnc-site-muted, #a1a1a6); --surface: var(--mnc-site-surface, rgb(30 30 32 / 96%)); --surface-solid: var(--mnc-site-surface-solid, #2b2b2e); --hover: var(--mnc-site-hover, #29364a); --selected: var(--mnc-site-selected, #173e68); --border: var(--mnc-site-border, rgb(255 255 255 / 13%)); box-shadow: 0 22px 55px var(--mnc-site-shadow, rgb(0 0 0 / 52%)); }
          .search-status { border-color: #7f1d1d; background: #2a1719; color: #fecaca; }
        }
        @media (prefers-reduced-motion: reduce) { .panel, .panel * { animation: none !important; transition: none !important; } }
      </style>
      <section class="panel" role="dialog" aria-modal="false" aria-label="בחירת תאריך">
        <div class="modes" role="group" aria-label="סוג לוח שנה">
          <button type="button" data-mode="gregorian" aria-pressed="true">לועזי</button>
          <button type="button" data-mode="hebrew" aria-pressed="false">עברי</button>
        </div>
        <div class="head">
          <button class="nav prev" type="button" data-action="prev" aria-label="החודש הקודם">‹</button>
          <div class="jump">
            <div class="month-picker">
              <button class="month-trigger" type="button" data-action="month-toggle" aria-haspopup="listbox" aria-expanded="false">
                <span class="month-trigger-text"></span><span class="month-chevron" aria-hidden="true"></span>
              </button>
              <div class="month-menu" role="listbox" hidden></div>
            </div>
            <input class="year-field" type="number" min="1" max="9999" inputmode="numeric" aria-label="שנה">
          </div>
          <button class="nav next" type="button" data-action="next" aria-label="החודש הבא">›</button>
        </div>
        <div class="hebrew-range" aria-live="polite"></div>
        <div class="weekdays" aria-hidden="true"></div>
        <div class="days" role="grid"></div>
        <div class="footer">
          <button type="button" data-action="clear">נקה</button>
          <form class="search" novalidate>
            <button type="button" data-action="search-toggle">חיפוש</button>
            <input type="text" autocomplete="off" spellcheck="false" aria-label="חיפוש תאריך" placeholder="י״ח באב תשפ״ו">
          </form>
          <button type="button" data-action="today">היום</button>
        </div>
        <div class="search-status" role="status"></div>
      </section>`;
    panel = shadow.querySelector(".panel");
    monthTrigger = shadow.querySelector(".month-trigger");
    monthTriggerText = shadow.querySelector(".month-trigger-text");
    monthMenu = shadow.querySelector(".month-menu");
    yearField = shadow.querySelector(".year-field");
    hebrewRange = shadow.querySelector(".hebrew-range");
    searchField = shadow.querySelector(".search input");
    searchStatus = shadow.querySelector(".search-status");
    modeButtons = shadow.querySelectorAll("[data-mode]");
    weekdays = shadow.querySelector(".weekdays");
    days = shadow.querySelector(".days");
    shadow.addEventListener("click", onPickerClick);
    shadow.addEventListener("keydown", onPickerKeydown);
    shadow.addEventListener("change", onPickerChange);
    shadow.querySelector(".search").addEventListener("submit", onSearch);
  }

  function firstDayOfWeek() {
    try {
      const localeInfo = new Intl.Locale(locale);
      const week = typeof localeInfo.getWeekInfo === "function" ? localeInfo.getWeekInfo() : localeInfo.weekInfo;
      return week.firstDay % 7;
    }
    catch { return direction === "rtl" ? 0 : 1; }
  }

  function isAllowed(value) {
    const min = parse(input.min);
    const max = parse(input.max);
    return (!min || value >= min) && (!max || value <= max);
  }

  const hebrewPartsFormatter = new Intl.DateTimeFormat("en-US-u-ca-hebrew-nu-latn", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
  });
  const hebrewMonthLabels = {
    "Tishri": "תשרי", "Heshvan": "חשוון", "Kislev": "כסלו", "Tevet": "טבת",
    "Shevat": "שבט", "Adar": "אדר", "Adar I": "אדר א׳", "Adar II": "אדר ב׳",
    "Nisan": "ניסן", "Iyar": "אייר", "Sivan": "סיוון", "Tamuz": "תמוז",
    "Av": "אב", "Elul": "אלול"
  };

  function hebrewParts(date) {
    return Object.fromEntries(hebrewPartsFormatter.formatToParts(date).map(part => [part.type, part.value]));
  }

  function hebrewLeapYear(year) {
    return ((7 * year + 1) % 19) < 7;
  }

  function hebrewMonths(year) {
    return ["Tishri", "Heshvan", "Kislev", "Tevet", "Shevat",
      ...(hebrewLeapYear(year) ? ["Adar I", "Adar II"] : ["Adar"]),
      "Nisan", "Iyar", "Sivan", "Tamuz", "Av", "Elul"];
  }

  function findHebrewMonthStart(year, month) {
    const start = new Date(Date.UTC(year - 3761, 6, 1));
    for (let offset = 0; offset < 520; offset++) {
      const candidate = addDays(start, offset);
      const parts = hebrewParts(candidate);
      if (+parts.year === year && parts.month === month && +parts.day === 1) return candidate;
    }
    return null;
  }

  function hebrewNumeral(number) {
    let value = Number(number);
    if (value >= 5000 && value < 6000) value -= 5000;
    const hundreds = [[400,"ת"],[300,"ש"],[200,"ר"],[100,"ק"]];
    const remainder = [[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"],[9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"]];
    let result = "";
    for (const [amount, letter] of hundreds) while (value >= amount) { result += letter; value -= amount; }
    if (value === 15) { result += "טו"; value = 0; }
    if (value === 16) { result += "טז"; value = 0; }
    for (const [amount, letter] of remainder) while (value >= amount) { result += letter; value -= amount; }
    if (result.length === 1) return `${result}׳`;
    return `${result.slice(0, -1)}״${result.at(-1)}`;
  }

  function render(focusValue) {
    if (!input) return;
    panel.dir = direction;
    panel.classList.toggle("mode-hebrew", calendarMode === "hebrew");
    panel.classList.toggle("mode-gregorian", calendarMode === "gregorian");
    panel.setAttribute("aria-label", locale.startsWith("he") ? "בחירת תאריך" : "Choose date");
    for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === calendarMode));
    monthMenu.replaceChildren();
    monthMenu.hidden = true;
    monthTrigger.setAttribute("aria-expanded", "false");
    let first;
    let belongsToViewedMonth;
    let dayText;
    let dateLabel;

    if (calendarMode === "gregorian") {
      const monthFormat = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
      for (let month = 0; month < 12; month++) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "month-option";
        option.dataset.month = String(month);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(month === viewMonth));
        option.textContent = monthFormat.format(new Date(Date.UTC(2024, month, 1)));
        monthMenu.append(option);
        if (month === viewMonth) monthTriggerText.textContent = option.textContent;
      }
      yearField.type = "number";
      yearField.inputMode = "numeric";
      yearField.value = String(viewYear);
      first = new Date(Date.UTC(viewYear, viewMonth, 1));
      belongsToViewedMonth = date => date.getUTCFullYear() === viewYear && date.getUTCMonth() === viewMonth;
      const numberFormat = new Intl.NumberFormat(locale);
      dayText = date => numberFormat.format(date.getUTCDate());
      const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
      dateLabel = date => fullDate.format(date);

      const lastGregorian = new Date(Date.UTC(viewYear, viewMonth + 1, 0));
      const hebrewMonthFormat = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { month: "long", year: "numeric", timeZone: "UTC" });
      const hebrewStart = hebrewMonthFormat.format(first);
      const hebrewEnd = hebrewMonthFormat.format(lastGregorian);
      hebrewRange.textContent = hebrewStart === hebrewEnd ? hebrewStart : `${hebrewStart} – ${hebrewEnd}`;
    } else {
      const months = hebrewMonths(hebrewViewYear);
      if (!months.includes(hebrewViewMonth)) hebrewViewMonth = months.includes("Adar") ? "Adar" : "Adar II";
      for (const month of months) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "month-option";
        option.dataset.month = month;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(month === hebrewViewMonth));
        option.textContent = hebrewMonthLabels[month];
        monthMenu.append(option);
        if (month === hebrewViewMonth) monthTriggerText.textContent = option.textContent;
      }
      yearField.type = "text";
      yearField.inputMode = "text";
      yearField.value = hebrewNumeral(hebrewViewYear);
      first = findHebrewMonthStart(hebrewViewYear, hebrewViewMonth) || today();
      belongsToViewedMonth = date => {
        const parts = hebrewParts(date);
        return +parts.year === hebrewViewYear && parts.month === hebrewViewMonth;
      };
      dayText = date => hebrewNumeral(+hebrewParts(date).day);
      const gregorianFull = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
      dateLabel = date => {
        const parts = hebrewParts(date);
        return `${hebrewNumeral(+parts.day)} ב${hebrewMonthLabels[parts.month]} ${hebrewNumeral(+parts.year)} · ${gregorianFull.format(date)}`;
      };

      const index = months.indexOf(hebrewViewMonth);
      const nextYear = index === months.length - 1 ? hebrewViewYear + 1 : hebrewViewYear;
      const nextMonth = index === months.length - 1 ? hebrewMonths(nextYear)[0] : months[index + 1];
      const nextStart = findHebrewMonthStart(nextYear, nextMonth);
      const last = nextStart ? addDays(nextStart, -1) : addDays(first, 29);
      const gregorianRange = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      hebrewRange.textContent = `${gregorianRange.format(first)} – ${gregorianRange.format(last)}`;
    }

    const firstWeekday = firstDayOfWeek();
    weekdays.replaceChildren();
    const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
    for (let index = 0; index < 7; index++) {
      const element = document.createElement("div");
      element.className = "weekday";
      element.textContent = weekdayFormat.format(new Date(Date.UTC(2024, 0, 7 + ((firstWeekday + index) % 7))));
      weekdays.append(element);
    }

    const offset = (first.getUTCDay() - firstWeekday + 7) % 7;
    const start = addDays(first, -offset);
    const selected = input.value;
    const todayValue = iso(today());
    days.replaceChildren();
    for (let index = 0; index < 42; index++) {
      const date = addDays(start, index);
      const value = iso(date);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day";
      button.dataset.date = value;
      button.textContent = dayText(date);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", dateLabel(date));
      if (!belongsToViewedMonth(date)) button.classList.add("other");
      if (value === todayValue) {
        button.classList.add("today");
        button.setAttribute("aria-current", "date");
      }
      if (value === selected) {
        button.classList.add("selected");
        button.setAttribute("aria-selected", "true");
      }
      button.disabled = !isAllowed(date);
      days.append(button);
    }

    const labels = locale.startsWith("he")
      ? { prev: "החודש הקודם", next: "החודש הבא", clear: "נקה", today: "היום", month: "חודש", year: "שנה", search: "חיפוש תאריך", searchToggle: "חיפוש", find: "מצא", gregorian: "לועזי", hebrew: "עברי", modes: "סוג לוח שנה" }
      : { prev: "Previous month", next: "Next month", clear: "Clear", today: "Today", month: "Month", year: "Year", search: "Find a date", searchToggle: "Search", find: "Find", gregorian: "Gregorian", hebrew: "Hebrew", modes: "Calendar type" };
    for (const action of ["prev", "next", "clear", "today"]) {
      const label = labels[action];
      const button = shadow.querySelector(`[data-action="${action}"]`);
      button.setAttribute("aria-label", label);
      if (action === "clear" || action === "today") button.textContent = label;
    }
    shadow.querySelector('[data-action="prev"]').textContent = "‹";
    shadow.querySelector('[data-action="next"]').textContent = "›";
    monthTrigger.setAttribute("aria-label", labels.month);
    monthMenu.setAttribute("aria-label", labels.month);
    yearField.setAttribute("aria-label", labels.year);
    searchField.setAttribute("aria-label", labels.search);
    shadow.querySelector('[data-action="search-toggle"]').textContent = labels.searchToggle;
    shadow.querySelector(".modes").setAttribute("aria-label", labels.modes);
    for (const button of modeButtons) button.textContent = labels[button.dataset.mode];

    position();
    if (focusValue) requestAnimationFrame(() => {
      const target = days.querySelector(`[data-date="${focusValue}"]:not(:disabled)`)
        || days.querySelector(".selected:not(:disabled), .today:not(:disabled), .day:not(:disabled)");
      target?.focus();
    });
  }

  function position() {
    if (!input || !panel) return;
    const rect = input.getBoundingClientRect();
    const width = panel.offsetWidth || 304;
    const height = panel.offsetHeight || 350;
    const gap = 6;
    let left = direction === "rtl" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, innerWidth - width - 8));
    let top = rect.bottom + gap;
    if (top + height > innerHeight - 8 && rect.top - height - gap >= 8) top = rect.top - height - gap;
    else top = Math.max(8, Math.min(top, innerHeight - height - 8));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function open(target) {
    if (target.disabled || target.readOnly) return;
    ensurePicker();
    input = target;
    locale = target.lang || target.closest("[lang]")?.lang || document.documentElement.lang || navigator.language || "he-IL";
    direction = getComputedStyle(target).direction || document.dir || "ltr";
    const current = parse(target.value) || today();
    viewYear = current.getUTCFullYear();
    viewMonth = current.getUTCMonth();
    const currentHebrew = hebrewParts(current);
    hebrewViewYear = +currentHebrew.year;
    hebrewViewMonth = currentHebrew.month;
    if (!host.isConnected) (document.body || document.documentElement).append(host);
    searchStatus.textContent = "";
    searchField.value = "";
    panel.classList.remove("search-open");
    render();
  }

  function close(returnFocus = false) {
    const previous = input;
    clearTimeout(modeTimer);
    panel?.classList.remove("mode-exit", "mode-enter");
    input = null;
    host?.remove();
    if (returnFocus) previous?.focus({ preventScroll: true });
  }

  function choose(value) {
    if (!input) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close(true);
  }

  function moveMonth(amount) {
    if (calendarMode === "hebrew") {
      let months = hebrewMonths(hebrewViewYear);
      let index = months.indexOf(hebrewViewMonth) + amount;
      if (index < 0) {
        hebrewViewYear--;
        months = hebrewMonths(hebrewViewYear);
        index = months.length - 1;
      } else if (index >= months.length) {
        hebrewViewYear++;
        months = hebrewMonths(hebrewViewYear);
        index = 0;
      }
      hebrewViewMonth = months[index];
      render();
      return;
    }
    const next = new Date(Date.UTC(viewYear, viewMonth + amount, 1));
    viewYear = next.getUTCFullYear();
    viewMonth = next.getUTCMonth();
    render();
  }

  const hebrewLetterValues = {
    א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
    י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50,
    ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200,
    ש: 300, ת: 400
  };

  function hebrewNumber(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    if (digits) return +digits;
    return [...String(value || "")].reduce((sum, letter) => sum + (hebrewLetterValues[letter] || 0), 0);
  }

  function normalizeHebrew(value) {
    return String(value)
      .normalize("NFKD")
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[׳״'\"]/g, "")
      .replace(/[^\u05D0-\u05EA0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findHebrewDate(query) {
    const text = normalizeHebrew(query);
    const aliases = [
      ["אדר הראשון", ["Adar I"]], ["אדר ראשון", ["Adar I"]], ["אדר א", ["Adar I"]],
      ["אדר השני", ["Adar II"]], ["אדר שני", ["Adar II"]], ["אדר ב", ["Adar II"]],
      ["מר חשון", ["Heshvan"]], ["מרחשון", ["Heshvan"]], ["חשוון", ["Heshvan"]], ["חשון", ["Heshvan"]],
      ["תשרי", ["Tishri"]], ["כסלו", ["Kislev"]], ["טבת", ["Tevet"]],
      ["שבט", ["Shevat"]], ["אדר", ["Adar", "Adar II"]], ["ניסן", ["Nisan"]],
      ["אייר", ["Iyar"]], ["סיוון", ["Sivan"]], ["סיון", ["Sivan"]],
      ["תמוז", ["Tamuz"]], ["אלול", ["Elul"]], ["אב", ["Av"]]
    ];
    let found;
    for (const [alias, months] of aliases) {
      const index = text.indexOf(alias);
      if (index >= 0) { found = { alias, months, index }; break; }
    }
    if (!found) return null;

    let monthStart = found.index;
    if (monthStart > 0 && /[בל]/.test(text[monthStart - 1]) && (monthStart === 1 || text[monthStart - 2] === " ")) monthStart--;
    const before = text.slice(0, monthStart).trim().split(" ").filter(Boolean);
    const after = text.slice(found.index + found.alias.length).trim().split(" ").filter(Boolean);
    const day = hebrewNumber(before.at(-1));
    let year = hebrewNumber(after[0]);
    if (!day || day > 30 || !year) return null;
    if (year < 1000) year += 5000;

    for (const month of found.months) {
      const first = findHebrewMonthStart(year, month);
      if (!first) continue;
      const candidate = addDays(first, day - 1);
      const parts = hebrewParts(candidate);
      if (+parts.year === year && parts.month === month && +parts.day === day) return candidate;
    }
    return null;
  }

  function findDate(query) {
    const value = String(query).trim();
    const direct = parse(value);
    if (direct && iso(direct) === value) return direct;
    const numeric = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value);
    if (numeric) {
      const candidate = new Date(Date.UTC(+numeric[3], +numeric[2] - 1, +numeric[1]));
      if (candidate.getUTCDate() === +numeric[1] && candidate.getUTCMonth() === +numeric[2] - 1) return candidate;
    }
    return findHebrewDate(value);
  }

  function onSearch(event) {
    event.preventDefault();
    const result = findDate(searchField.value);
    if (!result || !isAllowed(result)) {
      searchStatus.textContent = locale.startsWith("he") ? "לא נמצא תאריך תקין בטווח השדה" : "No valid date was found in range";
      searchField.focus();
      return;
    }
    searchStatus.textContent = "";
    choose(iso(result));
  }

  function onPickerChange(event) {
    if (event.target === yearField) {
      if (calendarMode === "hebrew") {
        let year = hebrewNumber(yearField.value);
        if (year < 1000) year += 5000;
        if (year >= 1 && year <= 9999) {
          hebrewViewYear = year;
          const months = hebrewMonths(year);
          if (!months.includes(hebrewViewMonth)) hebrewViewMonth = months.includes("Adar") ? "Adar" : "Adar II";
        }
      } else {
        viewYear = Math.max(1, Math.min(9999, +yearField.value || viewYear));
      }
      render();
    }
  }

  function changeCalendarMode(nextMode) {
    if (nextMode === calendarMode || panel.classList.contains("mode-exit")) return;
    clearTimeout(modeTimer);
    panel.classList.remove("mode-enter");
    const commit = () => {
      calendarMode = nextMode;
      if (calendarMode === "hebrew") {
        const preferred = parse(input.value) || today();
        const anchor = preferred.getUTCFullYear() === viewYear && preferred.getUTCMonth() === viewMonth
          ? preferred
          : new Date(Date.UTC(viewYear, viewMonth, 15));
        const parts = hebrewParts(anchor);
        hebrewViewYear = +parts.year;
        hebrewViewMonth = parts.month;
      } else {
        const preferred = parse(input.value) || today();
        const preferredHebrew = hebrewParts(preferred);
        const first = findHebrewMonthStart(hebrewViewYear, hebrewViewMonth) || today();
        const anchor = +preferredHebrew.year === hebrewViewYear && preferredHebrew.month === hebrewViewMonth
          ? preferred
          : addDays(first, 14);
        viewYear = anchor.getUTCFullYear();
        viewMonth = anchor.getUTCMonth();
      }
      render();
      panel.classList.remove("mode-exit");
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        panel.classList.add("mode-enter");
        modeTimer = setTimeout(() => panel.classList.remove("mode-enter"), 190);
      }
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) commit();
    else {
      panel.classList.add("mode-exit");
      modeTimer = setTimeout(commit, 85);
    }
  }

  function onPickerClick(event) {
    const button = event.target.closest("button");
    if (!button || !input) return;
    if (button.dataset.action === "month-toggle") {
      monthMenu.hidden = !monthMenu.hidden;
      monthTrigger.setAttribute("aria-expanded", String(!monthMenu.hidden));
      if (!monthMenu.hidden) requestAnimationFrame(() => monthMenu.querySelector('[aria-selected="true"]')?.focus());
      return;
    }
    if (button.dataset.month !== undefined) {
      if (calendarMode === "hebrew") hebrewViewMonth = button.dataset.month;
      else viewMonth = +button.dataset.month;
      render();
      return;
    }
    monthMenu.hidden = true;
    monthTrigger.setAttribute("aria-expanded", "false");
    if (button.dataset.mode) {
      changeCalendarMode(button.dataset.mode);
      return;
    }
    if (button.dataset.date) return choose(button.dataset.date);
    if (button.dataset.action === "prev") moveMonth(-1);
    if (button.dataset.action === "next") moveMonth(1);
    if (button.dataset.action === "search-toggle") {
      panel.classList.toggle("search-open");
      if (panel.classList.contains("search-open")) requestAnimationFrame(() => searchField.focus());
      position();
    }
    if (button.dataset.action === "clear") choose("");
    if (button.dataset.action === "today" && isAllowed(today())) choose(iso(today()));
  }

  function onPickerKeydown(event) {
    if (event.target === searchField && event.key === "Enter") {
      event.preventDefault();
      onSearch(event);
      return;
    }
    const monthOption = event.target.closest(".month-option");
    if (monthOption && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const options = [...monthMenu.querySelectorAll(".month-option")];
      const index = options.indexOf(monthOption);
      options[Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
      return;
    }
    const dateButton = event.target.closest("[data-date]");
    if (!dateButton) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(dateButton.dataset.date);
      return;
    }
    const offsets = { ArrowLeft: direction === "rtl" ? 1 : -1, ArrowRight: direction === "rtl" ? -1 : 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = addDays(parse(dateButton.dataset.date), offsets[event.key]);
    if (!isAllowed(next)) return;
    const outside = calendarMode === "hebrew"
      ? (+hebrewParts(next).year !== hebrewViewYear || hebrewParts(next).month !== hebrewViewMonth)
      : (next.getUTCMonth() !== viewMonth || next.getUTCFullYear() !== viewYear);
    if (outside) {
      if (calendarMode === "hebrew") {
        const parts = hebrewParts(next);
        hebrewViewYear = +parts.year;
        hebrewViewMonth = parts.month;
      } else {
        viewYear = next.getUTCFullYear();
        viewMonth = next.getUTCMonth();
      }
      render(iso(next));
    } else {
      days.querySelector(`[data-date="${iso(next)}"]`)?.focus();
    }
  }

  function dateInput(target) {
    return target instanceof HTMLInputElement
      && target.type === "date"
      && !target.closest("[data-mnc-ignore]");
  }

  document.addEventListener("click", event => {
    if (dateInput(event.target)) {
      event.preventDefault();
      event.target.focus({ preventScroll: true });
      open(event.target);
    } else if (input && event.target !== host) {
      close();
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (dateInput(event.target) && ["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      open(event.target);
      requestAnimationFrame(() => days.querySelector(".selected:not(:disabled), .today:not(:disabled), .day:not(:disabled)")?.focus());
    } else if (event.key === "Escape" && input) {
      event.preventDefault();
      close(true);
    }
  }, true);

  addEventListener("resize", position, { passive: true });
  addEventListener("scroll", () => input && close(), { capture: true, passive: true });
})();
