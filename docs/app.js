(() => {
  "use strict";

  const root = document.documentElement;
  const storedTheme = localStorage.getItem("mnc-site-theme");
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = storedTheme || (systemDark ? "dark" : "light");

  document.querySelector(".theme-toggle").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("mnc-site-theme", next);
    document.querySelector('meta[name="theme-color"]').content = next === "dark" ? "#0c0e13" : "#f5f7fb";
  });

  const header = document.querySelector(".site-header");
  addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 20), { passive: true });

  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: .12 });
  document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));

  function animatedClose(element, trigger) {
    if (!element || element.hidden) return;
    element.classList.add("closing");
    trigger?.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      element.hidden = true;
      element.classList.remove("closing");
    }, 145);
  }

  function togglePopup(trigger, popup) {
    const opening = popup.hidden;
    document.querySelectorAll(".modern-menu:not([hidden]), .modern-calendar:not([hidden])").forEach(open => {
      if (open !== popup) animatedClose(open, open.previousElementSibling);
    });
    if (opening) {
      popup.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    } else animatedClose(popup, trigger);
  }

  const modernSelect = document.querySelector(".modern-select-trigger");
  const modernMenu = document.querySelector(".modern-menu");
  modernSelect.addEventListener("click", event => {
    event.stopPropagation();
    togglePopup(modernSelect, modernMenu);
  });
  modernMenu.addEventListener("click", event => {
    const option = event.target.closest("button");
    if (!option) return;
    modernMenu.querySelectorAll("button").forEach(button => {
      const selected = button === option;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    modernSelect.querySelector("span").textContent = option.querySelector("span").textContent;
    animatedClose(modernMenu, modernSelect);
  });

  const legacySelect = document.querySelector(".legacy-select-trigger");
  const legacyMenu = document.querySelector(".legacy-menu");
  legacySelect.addEventListener("click", event => {
    event.stopPropagation();
    legacyMenu.hidden = !legacyMenu.hidden;
    legacySelect.setAttribute("aria-expanded", String(!legacyMenu.hidden));
  });
  legacyMenu.addEventListener("click", event => {
    const option = event.target.closest("button");
    if (!option) return;
    legacySelect.firstChild.textContent = `${option.textContent} `;
    legacyMenu.hidden = true;
    legacySelect.setAttribute("aria-expanded", "false");
  });

  const legacyDate = document.querySelector(".legacy-date-trigger");
  const legacyCalendar = document.querySelector(".legacy-calendar");
  legacyDate.addEventListener("click", event => {
    event.stopPropagation();
    legacyCalendar.hidden = !legacyCalendar.hidden;
    legacyDate.setAttribute("aria-expanded", String(!legacyCalendar.hidden));
  });

  const modernDate = document.querySelector(".modern-date-trigger");
  const modernCalendar = document.querySelector(".modern-calendar");
  const calendarDays = document.querySelector(".calendar-days");
  const calendarTitle = document.querySelector(".calendar-title");
  let calendarMode = "gregorian";

  const daysByMode = {
    gregorian: [
      { label: "26", muted: true }, { label: "27", muted: true }, { label: "28", muted: true }, { label: "29", muted: true }, { label: "30", muted: true }, { label: "31", muted: true },
      ...Array.from({ length: 31 }, (_, index) => ({ label: String(index + 1), today: index === 11, selected: index === 11 }))
    ],
    hebrew: [
      { label: "כ״ו", muted: true }, { label: "כ״ז", muted: true }, { label: "כ״ח", muted: true }, { label: "כ״ט", muted: true },
      ...["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ז׳","ח׳","ט׳","י׳","י״א","י״ב","י״ג","י״ד","ט״ו","ט״ז","י״ז","י״ח","י״ט","כ׳","כ״א","כ״ב","כ״ג","כ״ד","כ״ה","כ״ו","כ״ז","כ״ח","כ״ט","ל׳"].map((label, index) => ({ label, today: index === 17, selected: index === 17 }))
    ]
  };

  function renderCalendar() {
    calendarDays.replaceChildren(...daysByMode[calendarMode].map(day => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = day.label;
      button.classList.toggle("muted", Boolean(day.muted));
      button.classList.toggle("today", Boolean(day.today));
      button.classList.toggle("selected", Boolean(day.selected));
      return button;
    }));
    calendarTitle.textContent = calendarMode === "gregorian" ? "אוגוסט 2026" : "אב תשפ״ו";
  }
  renderCalendar();

  modernDate.addEventListener("click", event => {
    event.stopPropagation();
    togglePopup(modernDate, modernCalendar);
  });
  document.querySelector(".calendar-mode").addEventListener("click", event => {
    const modeButton = event.target.closest("[data-mode]");
    if (!modeButton || modeButton.dataset.mode === calendarMode) return;
    calendarDays.classList.add("switching");
    document.querySelectorAll(".calendar-mode button").forEach(button => button.classList.toggle("active", button === modeButton));
    setTimeout(() => {
      calendarMode = modeButton.dataset.mode;
      renderCalendar();
      requestAnimationFrame(() => calendarDays.classList.remove("switching"));
    }, 140);
  });
  calendarDays.addEventListener("click", event => {
    const day = event.target.closest("button");
    if (!day || day.classList.contains("muted")) return;
    calendarDays.querySelectorAll(".selected").forEach(item => item.classList.remove("selected"));
    day.classList.add("selected");
    modernDate.querySelector("span").textContent = calendarMode === "gregorian" ? `${day.textContent} באוגוסט 2026` : `${day.textContent} באב תשפ״ו`;
  });
  document.querySelector(".today-action").addEventListener("click", () => {
    const today = calendarDays.querySelector(".today");
    calendarDays.querySelectorAll(".selected").forEach(item => item.classList.remove("selected"));
    today?.classList.add("selected");
  });
  document.querySelector(".clear-action").addEventListener("click", () => {
    calendarDays.querySelectorAll(".selected").forEach(item => item.classList.remove("selected"));
    modernDate.querySelector("span").textContent = "בחירת תאריך";
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".modern-select-wrap")) animatedClose(modernMenu, modernSelect);
    if (!event.target.closest(".modern-date-wrap")) animatedClose(modernCalendar, modernDate);
    if (!event.target.closest(".legacy-form")) {
      legacyMenu.hidden = true;
      legacyCalendar.hidden = true;
      legacySelect.setAttribute("aria-expanded", "false");
      legacyDate.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    animatedClose(modernMenu, modernSelect);
    animatedClose(modernCalendar, modernDate);
    legacyMenu.hidden = true;
    legacyCalendar.hidden = true;
  });
})();
