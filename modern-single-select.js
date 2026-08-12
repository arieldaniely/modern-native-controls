(() => {
  "use strict";

  let active = null;
  let host = null;
  let root = null;
  let panel = null;
  let list = null;
  let observer = null;
  let previousAria = null;
  let closeTimer = 0;

  function eligible(target) {
    return target instanceof HTMLSelectElement
      && !target.multiple
      && (!target.hasAttribute("size") || target.size === 1)
      && (target.hasAttribute("class") || target.hasAttribute("style"))
      && !target.disabled
      && !target.closest("[data-mnc-ignore]");
  }

  function ensureHost() {
    if (host) return;
    host = document.createElement("div");
    host.id = "modern-native-select-picker";
    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      pointerEvents: "none"
    });
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { color-scheme: light dark; }
        * { box-sizing: border-box; }
        .panel {
          position: fixed; overflow: hidden; padding: .28rem;
          border: 1px solid var(--mnc-site-border, rgb(0 0 0 / 16%)); border-radius: .7rem;
          background: var(--mnc-site-surface-solid, #fff); color: var(--mnc-site-text, #1d1d1f);
          box-shadow: 0 14px 36px var(--mnc-site-shadow, rgb(0 0 0 / 20%));
          backdrop-filter: blur(18px); pointer-events: auto;
          opacity: 1; transform: translateY(0) scale(1); transform-origin: top center;
          animation: appear 175ms cubic-bezier(.2,.8,.2,1);
          transition: opacity 135ms ease, transform 155ms cubic-bezier(.4,0,1,1);
        }
        .list {
          overflow: auto; max-block-size: min(14rem, 44vh); padding: 0;
          scrollbar-width: thin; scrollbar-color: var(--mnc-site-muted, rgb(142 142 147 / 55%)) transparent;
          overscroll-behavior: contain;
        }
        .list::-webkit-scrollbar { inline-size: .5rem; }
        .list::-webkit-scrollbar-button { display: none; inline-size: 0; block-size: 0; }
        .list::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 999px; background: var(--mnc-site-muted, rgb(142 142 147 / 55%)); background-clip: padding-box; }
        .option {
          display: grid; grid-template-columns: minmax(0, 1fr) .9rem; align-items: center; gap: .55rem;
          inline-size: 100%; min-block-size: 1.75rem; margin: .03rem 0; padding: .3rem .48rem;
          border: 0; border-radius: .46rem; background: transparent; color: inherit; font: inherit;
          line-height: 1.2; text-align: start; cursor: pointer;
        }
        .option:hover, .option:focus-visible { outline: 0; background: var(--mnc-site-hover, #f1f5f9); }
        .option[aria-selected="true"] { background: var(--mnc-site-selected, #e7f1ff); color: var(--mnc-site-accent-hover, #0068e6); font-weight: 620; }
        .option:disabled { opacity: .42; cursor: not-allowed; }
        .check { color: var(--mnc-site-accent, #0a7aff); font-size: .9rem; font-weight: 800; opacity: 0; }
        .option[aria-selected="true"] .check { opacity: 1; }
        .group { padding: .48rem .5rem .2rem; color: var(--mnc-site-muted, #6e6e73); font-size: .72rem; font-weight: 720; }
        .panel.closing { opacity: 0; transform: translateY(-3px) scale(.985); animation: none; }
        @keyframes appear { from { opacity: 0; transform: translateY(-4px) scale(.98); } }
        @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
        @media (prefers-color-scheme: dark) {
          .panel { border-color: var(--mnc-site-border, #475569); background: var(--mnc-site-surface-solid, #171b24); color: var(--mnc-site-text, #f1f5f9); }
          .option:hover, .option:focus-visible { background: var(--mnc-site-hover, #202b3c); }
          .option[aria-selected="true"] { background: var(--mnc-site-selected, #1e3a5f); color: var(--mnc-site-accent-hover, #bfdbfe); }
        }
      </style>
      <div class="panel" role="presentation"><div class="list" role="listbox"></div></div>`;
    panel = root.querySelector(".panel");
    list = root.querySelector(".list");

    root.addEventListener("click", event => {
      const option = event.target.closest(".option");
      if (!option || option.disabled || !active) return;
      const index = +option.dataset.index;
      if (active.selectedIndex !== index) {
        active.selectedIndex = index;
        active.dispatchEvent(new Event("input", { bubbles: true }));
        active.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close(true);
    });

    root.addEventListener("keydown", event => {
      const option = event.target.closest(".option");
      if (!option) return;
      const options = [...root.querySelectorAll(".option:not(:disabled)")];
      const current = options.indexOf(option);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        options[(current + delta + options.length) % options.length]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        option.click();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    });
  }

  function render() {
    if (!active) return;
    list.replaceChildren();
    list.setAttribute("aria-label", active.getAttribute("aria-label") || active.labels?.[0]?.textContent?.trim() || "אפשרויות");
    let index = 0;
    for (const child of active.children) {
      if (child instanceof HTMLOptGroupElement) {
        const heading = document.createElement("div");
        heading.className = "group";
        heading.textContent = child.label;
        list.append(heading);
        for (const option of child.children) appendOption(option, index++, child.disabled);
      } else if (child instanceof HTMLOptionElement) {
        appendOption(child, index++, false);
      }
    }
  }

  function appendOption(option, index, groupDisabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.index = String(index);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(option.selected));
    button.disabled = option.disabled || groupDisabled;
    const text = document.createElement("span");
    text.textContent = option.label || option.textContent;
    const check = document.createElement("span");
    check.className = "check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    button.append(text, check);
    list.append(button);
  }

  function position() {
    if (!active || !host?.isConnected) return;
    const rect = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    panel.style.font = style.font;
    panel.style.direction = style.direction;
    const width = Math.min(Math.max(rect.width, 150), innerWidth - 16);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, style.direction === "rtl" ? rect.right - width : rect.left))}px`;
    panel.style.top = `${Math.min(innerHeight - 8, rect.bottom + 5)}px`;
    const height = panel.getBoundingClientRect().height;
    if (rect.bottom + 5 + height > innerHeight - 8 && rect.top - height - 5 >= 8) {
      panel.style.top = `${rect.top - height - 5}px`;
      panel.style.transformOrigin = "bottom center";
    } else {
      panel.style.transformOrigin = "top center";
    }
  }

  function open(select) {
    if (active === select) return close(true);
    close(false, true);
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = 0;
      host?.remove();
    }
    ensureHost();
    panel.classList.remove("closing");
    active = select;
    previousAria = {
      expanded: select.getAttribute("aria-expanded"),
      haspopup: select.getAttribute("aria-haspopup")
    };
    select.setAttribute("aria-expanded", "true");
    select.setAttribute("aria-haspopup", "listbox");
    (document.body || document.documentElement).append(host);
    render();
    position();
    observer = new MutationObserver(() => { render(); position(); });
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["selected", "disabled", "label"] });
    requestAnimationFrame(() => {
      const selected = root.querySelector('.option[aria-selected="true"]:not(:disabled)') || root.querySelector(".option:not(:disabled)");
      selected?.scrollIntoView({ block: "nearest" });
      selected?.focus({ preventScroll: true });
    });
  }

  function close(restoreFocus = false, immediate = false) {
    if (!active) return;
    const select = active;
    observer?.disconnect();
    observer = null;
    if (previousAria.expanded === null) select.removeAttribute("aria-expanded");
    else select.setAttribute("aria-expanded", previousAria.expanded);
    if (previousAria.haspopup === null) select.removeAttribute("aria-haspopup");
    else select.setAttribute("aria-haspopup", previousAria.haspopup);
    active = null;
    const finish = () => {
      closeTimer = 0;
      host?.remove();
      panel?.classList.remove("closing");
      if (restoreFocus && select.isConnected) select.focus({ preventScroll: true });
    };
    if (immediate) finish();
    else {
      panel?.classList.add("closing");
      closeTimer = setTimeout(finish, 160);
    }
  }

  document.addEventListener("pointerdown", event => {
    if (eligible(event.target)) {
      event.preventDefault();
      event.target.focus({ preventScroll: true });
      open(event.target);
    } else if (active && event.target !== host) {
      close(false);
    }
  }, true);

  document.addEventListener("click", event => {
    if (eligible(event.target)) event.preventDefault();
  }, true);

  document.addEventListener("keydown", event => {
    if (eligible(event.target) && (event.key === "Enter" || event.key === " " || (event.altKey && event.key === "ArrowDown"))) {
      event.preventDefault();
      open(event.target);
    } else if (event.key === "Escape" && active) {
      event.preventDefault();
      close(true);
    }
  }, true);

  addEventListener("resize", position, { passive: true });
  addEventListener("scroll", () => active && close(false), { capture: true, passive: true });
})();
