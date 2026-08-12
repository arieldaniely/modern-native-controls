(() => {
  "use strict";

  const runtimeMarker = "data-mnc-multi-select-runtime";
  if (document.documentElement.hasAttribute(runtimeMarker)) return;
  document.documentElement.setAttribute(runtimeMarker, "");

  const enhanced = new WeakMap();

  function labelFor(select) {
    if (select.getAttribute("aria-label")) return select.getAttribute("aria-label");
    if (select.id) {
      const escaped = CSS.escape(select.id);
      const label = document.querySelector(`label[for="${escaped}"]`);
      if (label) return label.textContent.trim();
    }
    return select.closest("label")?.textContent.trim() || "בחירה מרובה";
  }

  function enhance(select) {
    if (enhanced.has(select)) return;
    if (select.closest("[data-mnc-ignore]")) return;
    const existingHosts = [];
    let sibling = select.nextElementSibling;
    while (sibling?.classList.contains("modern-multi-select-host")) {
      existingHosts.push(sibling);
      sibling = sibling.nextElementSibling;
    }
    if (existingHosts.length) {
      for (const duplicate of existingHosts.slice(1)) duplicate.remove();
      select.hidden = true;
      select.style.setProperty("display", "none", "important");
      return;
    }
    const measuredWidth = select.getBoundingClientRect().width;
    const computed = getComputedStyle(select);
    const host = document.createElement("span");
    host.className = "modern-multi-select-host";
    host.style.display = computed.display === "block" ? "block" : "inline-block";
    host.style.width = `${Math.max(150, measuredWidth || 0)}px`;
    host.style.maxWidth = "100%";
    host.style.verticalAlign = "middle";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { color-scheme: light dark; }
        * { box-sizing: border-box; }
        .list {
          overflow: auto; padding: .24rem; border: 1px solid var(--mnc-site-border, rgb(0 0 0 / 15%)); border-radius: .6rem;
          background: var(--mnc-site-surface-solid, #fff); color: var(--mnc-site-text, #1d1d1f); font: 13px/1.25 system-ui, -apple-system, "Segoe UI", sans-serif;
          box-shadow: 0 2px 7px rgb(0 0 0 / 6%);
          scrollbar-width: none; overscroll-behavior: contain;
        }
        .option {
          display: grid; grid-template-columns: 1rem 1fr; align-items: center; gap: .45rem;
          inline-size: 100%; min-block-size: 1.85rem; padding: .28rem .4rem; border: 0;
          border-radius: .44rem; background: transparent; color: inherit; font: inherit;
          text-align: start; cursor: pointer;
        }
        .option:hover { background: var(--mnc-site-hover, #f3f3f5); }
        .option[aria-selected="true"] { background: var(--mnc-site-selected, #e7f1ff); color: var(--mnc-site-accent-hover, #0068e6); font-weight: 620; }
        .option:focus-visible { outline: 0; box-shadow: inset 0 0 0 2px var(--mnc-site-ring, rgb(10 122 255 / 55%)); }
        .option:disabled { opacity: .42; cursor: not-allowed; }
        .check {
          display: grid; place-items: center; inline-size: .95rem; block-size: .95rem;
          border: 1.5px solid var(--mnc-site-border-hover, #94a3b8); border-radius: .25rem; background: var(--mnc-site-surface-solid, #fff);
        }
        [aria-selected="true"] .check { border-color: var(--mnc-site-accent, #0a7aff); background: var(--mnc-site-accent, #0a7aff); box-shadow: 0 1px 3px var(--mnc-site-ring, rgb(10 122 255 / 28%)); }
        [aria-selected="true"] .check::after {
          content: ""; inline-size: .45rem; block-size: .28rem; border-left: 1.5px solid var(--mnc-site-on-accent, #fff);
          border-bottom: 1.5px solid var(--mnc-site-on-accent, #fff); rotate: -45deg; translate: 0 -.05rem;
        }
        .group { padding: .4rem .4rem .18rem; color: var(--mnc-site-muted, #64748b); font-size: .7rem; font-weight: 750; }
        @media (prefers-color-scheme: dark) {
          .list { border-color: var(--mnc-site-border, #475569); background: var(--mnc-site-surface-solid, #171b24); color: var(--mnc-site-text, #f1f5f9); }
          .option:hover { background: var(--mnc-site-hover, #202b3c); }
          .option[aria-selected="true"] { background: var(--mnc-site-selected, #1e3a5f); color: var(--mnc-site-accent-hover, #bfdbfe); }
          .check { border-color: var(--mnc-site-border-hover, #64748b); background: var(--mnc-site-surface-solid, #171b24); }
          [aria-selected="true"] .check { border-color: var(--mnc-site-accent, #0a7aff); background: var(--mnc-site-accent, #0a7aff); }
        }
      </style>
      <div class="list" role="listbox" aria-multiselectable="true"></div>`;
    const list = root.querySelector(".list");
    let lastIndex = -1;

    function render() {
      if (!select.isConnected) return;
      list.setAttribute("aria-label", labelFor(select));
      const rows = Math.max(2, Math.min(7, +(select.getAttribute("size") || 4)));
      list.style.maxBlockSize = `${rows * 1.9 + 0.44}rem`;
      list.replaceChildren();
      let index = 0;
      for (const child of select.children) {
        if (child instanceof HTMLOptGroupElement) {
          const group = document.createElement("div");
          group.className = "group";
          group.textContent = child.label;
          list.append(group);
          for (const option of child.children) appendOption(option, index++);
        } else if (child instanceof HTMLOptionElement) {
          appendOption(child, index++);
        }
      }
    }

    function appendOption(option, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.selected));
      button.disabled = option.disabled || option.parentElement?.disabled;
      const check = document.createElement("span");
      check.className = "check";
      check.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = option.label || option.textContent;
      button.append(check, text);
      list.append(button);
    }

    function toggle(index, shiftKey) {
      const options = [...select.options];
      const option = options[index];
      if (!option || option.disabled) return;
      if (shiftKey && lastIndex >= 0) {
        const selected = !option.selected;
        for (let i = Math.min(lastIndex, index); i <= Math.max(lastIndex, index); i++) {
          if (!options[i].disabled) options[i].selected = selected;
        }
      } else {
        option.selected = !option.selected;
      }
      lastIndex = index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      render();
      root.querySelector(`[data-index="${index}"]`)?.focus();
    }

    root.addEventListener("click", event => {
      const option = event.target.closest(".option");
      if (option) toggle(+option.dataset.index, event.shiftKey);
    });
    root.addEventListener("keydown", event => {
      const option = event.target.closest(".option");
      if (!option) return;
      const buttons = [...root.querySelectorAll(".option:not(:disabled)")];
      const current = buttons.indexOf(option);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        buttons[Math.max(0, Math.min(buttons.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggle(+option.dataset.index, event.shiftKey);
      }
    });

    const observer = new MutationObserver(render);
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["selected", "disabled", "label"] });
    select.addEventListener("input", render);
    select.addEventListener("change", render);
    select.form?.addEventListener("reset", () => setTimeout(render));
    select.after(host);
    select.hidden = true;
    select.style.setProperty("display", "none", "important");
    enhanced.set(select, { host, render, observer });
    render();
  }

  function discover(root = document) {
    root.querySelectorAll?.("select[multiple]").forEach(enhance);
  }

  function start() {
    discover();
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches("select[multiple]")) enhance(node);
        discover(node);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
