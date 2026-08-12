(() => {
  "use strict";

  const runtimeMarker = "data-mnc-scrollbar-runtime";
  if (document.documentElement.hasAttribute(runtimeMarker)) return;
  document.documentElement.setAttribute(runtimeMarker, "");

  let host;
  let vertical;
  let horizontal;
  let activeTarget;
  let hideTimer = 0;
  let frame = 0;

  function splitSelectors(selectorText) {
    const selectors = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < selectorText.length; index++) {
      const character = selectorText[index];
      if (character === "(" || character === "[") depth++;
      else if (character === ")" || character === "]") depth--;
      else if (character === "," && depth === 0) {
        selectors.push(selectorText.slice(start, index));
        start = index + 1;
      }
    }
    selectors.push(selectorText.slice(start));
    return selectors;
  }

  function selectorMatchesScrollbar(selectorText, target) {
    for (const selector of splitSelectors(selectorText)) {
      const pseudoIndex = selector.indexOf("::-webkit-scrollbar");
      if (pseudoIndex < 0) continue;
      const base = selector.slice(0, pseudoIndex).trim() || "*";
      try {
        if (target.matches(base)) return true;
      } catch {}
    }
    return false;
  }

  function rulesStyleScrollbar(rules, targets) {
    for (const rule of rules) {
      if (rule.cssRules && rulesStyleScrollbar(rule.cssRules, targets)) return true;
      if (!rule.selectorText) continue;
      const hasStandardStyle = rule.style?.getPropertyValue("scrollbar-width")
        || rule.style?.getPropertyValue("scrollbar-color")
        || rule.style?.getPropertyValue("scrollbar-gutter");
      if (hasStandardStyle) {
        for (const target of targets) {
          try {
            if (target.matches(rule.selectorText)) return true;
          } catch {}
        }
      }
      if (rule.selectorText.includes("::-webkit-scrollbar")) {
        for (const target of targets) {
          if (selectorMatchesScrollbar(rule.selectorText, target)) return true;
        }
      }
    }
    return false;
  }

  function computedScrollbarIsCustom(target) {
    const style = getComputedStyle(target);
    if (style.scrollbarWidth && style.scrollbarWidth !== "auto") return true;
    if (style.scrollbarColor && style.scrollbarColor !== "auto") return true;
    if (style.scrollbarGutter && style.scrollbarGutter !== "auto") return true;

    for (const pseudo of ["::-webkit-scrollbar", "::-webkit-scrollbar-thumb", "::-webkit-scrollbar-track"]) {
      const pseudoStyle = getComputedStyle(target, pseudo);
      if ((pseudoStyle.width && pseudoStyle.width !== "auto")
        || (pseudoStyle.height && pseudoStyle.height !== "auto")
        || pseudoStyle.display === "none"
        || (pseudoStyle.backgroundColor && pseudoStyle.backgroundColor !== "rgba(0, 0, 0, 0)")
        || (pseudoStyle.backgroundImage && pseudoStyle.backgroundImage !== "none")) return true;
    }
    return false;
  }

  function siteStylesScrollbar(target) {
    const targets = target === document.scrollingElement
      ? [document.documentElement, document.body].filter(Boolean)
      : [target];
    if (targets.some(computedScrollbarIsCustom)) return true;
    for (const sheet of document.styleSheets) {
      try {
        if (rulesStyleScrollbar(sheet.cssRules, targets)) return true;
      } catch {
        /* Cross-origin rules are covered where possible by computed styles. */
      }
    }
    return false;
  }

  function eligible(target) {
    if (!(target instanceof Element) || ignored(target)) return false;
    if (target.hasAttribute("data-mnc-scrollbar")) return true;
    if (siteStylesScrollbar(target)) return false;
    target.setAttribute("data-mnc-scrollbar", "");
    return true;
  }

  function ensureOverlay() {
    if (host) return;
    host = document.createElement("div");
    host.id = "modern-native-scrollbars";
    Object.assign(host.style, {
      all: "initial",
      position: "fixed",
      inset: "0",
      zIndex: "2147483645",
      pointerEvents: "none"
    });
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { pointer-events: none; }
        .thumb {
          position: fixed; display: none; border-radius: 999px;
          background: color-mix(in srgb, var(--mnc-site-accent, #0a7aff) 68%, var(--mnc-site-muted, #6e6e73));
          box-shadow: 0 1px 4px var(--mnc-site-shadow, rgb(0 0 0 / 18%));
          opacity: 0; pointer-events: auto; touch-action: none;
          transition: opacity 220ms ease, background-color 120ms ease;
        }
        .thumb.visible { opacity: .72; }
        .thumb:hover, .thumb.dragging { opacity: 1; }
        .vertical { inline-size: 5px; min-block-size: 24px; }
        .horizontal { block-size: 5px; min-inline-size: 24px; }
        @media (prefers-reduced-motion: reduce) { .thumb { transition: none; } }
      </style>
      <i class="thumb vertical"></i><i class="thumb horizontal"></i>`;
    vertical = root.querySelector(".vertical");
    horizontal = root.querySelector(".horizontal");
    addDrag(vertical, "vertical");
    addDrag(horizontal, "horizontal");
    (document.body || document.documentElement).append(host);
  }

  function ignored(target) {
    return target instanceof Element && Boolean(target.closest("[data-mnc-ignore]"));
  }

  function metrics(target) {
    const documentScroll = target === document.scrollingElement;
    const rect = documentScroll
      ? { top: 0, left: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight }
      : target.getBoundingClientRect();
    return { target, rect, documentScroll };
  }

  function update() {
    frame = 0;
    if (!activeTarget || !activeTarget.isConnected || !eligible(activeTarget)) return hide();
    ensureOverlay();
    const { target, rect } = metrics(activeTarget);
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));

    if (target.scrollHeight > target.clientHeight + 1 && visibleHeight > 28) {
      const track = Math.max(24, visibleHeight - 8);
      const thumb = Math.max(24, track * target.clientHeight / target.scrollHeight);
      const range = Math.max(1, target.scrollHeight - target.clientHeight);
      const travel = Math.max(0, track - thumb);
      vertical.style.display = "block";
      vertical.style.blockSize = `${thumb}px`;
      vertical.style.insetBlockStart = `${Math.max(4, rect.top + 4) + travel * target.scrollTop / range}px`;
      vertical.style.insetInlineStart = `${Math.min(innerWidth - 7, rect.right - 7)}px`;
      vertical.classList.add("visible");
    } else {
      vertical.style.display = "none";
    }

    if (target.scrollWidth > target.clientWidth + 1 && visibleWidth > 28) {
      const track = Math.max(24, visibleWidth - 8);
      const thumb = Math.max(24, track * target.clientWidth / target.scrollWidth);
      const range = Math.max(1, target.scrollWidth - target.clientWidth);
      const travel = Math.max(0, track - thumb);
      horizontal.style.display = "block";
      horizontal.style.inlineSize = `${thumb}px`;
      horizontal.style.insetInlineStart = `${Math.max(4, rect.left + 4) + travel * target.scrollLeft / range}px`;
      horizontal.style.insetBlockStart = `${Math.min(innerHeight - 7, rect.bottom - 7)}px`;
      horizontal.classList.add("visible");
    } else {
      horizontal.style.display = "none";
    }

    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 720);
  }

  function schedule(target) {
    activeTarget = target;
    if (!frame) frame = requestAnimationFrame(update);
  }

  function hide() {
    vertical?.classList.remove("visible");
    horizontal?.classList.remove("visible");
  }

  function addDrag(thumb, axis) {
    thumb.addEventListener("pointerdown", event => {
      if (!activeTarget) return;
      event.preventDefault();
      thumb.setPointerCapture(event.pointerId);
      thumb.classList.add("dragging");
      const target = activeTarget;
      const startPointer = axis === "vertical" ? event.clientY : event.clientX;
      const startScroll = axis === "vertical" ? target.scrollTop : target.scrollLeft;
      const viewport = axis === "vertical" ? target.clientHeight : target.clientWidth;
      const content = axis === "vertical" ? target.scrollHeight : target.scrollWidth;
      const thumbSize = axis === "vertical" ? thumb.offsetHeight : thumb.offsetWidth;
      const travel = Math.max(1, viewport - 8 - thumbSize);

      const move = moveEvent => {
        const pointer = axis === "vertical" ? moveEvent.clientY : moveEvent.clientX;
        const next = startScroll + (pointer - startPointer) * (content - viewport) / travel;
        if (axis === "vertical") target.scrollTop = next;
        else target.scrollLeft = next;
      };
      const finish = () => {
        thumb.classList.remove("dragging");
        thumb.removeEventListener("pointermove", move);
        thumb.removeEventListener("pointerup", finish);
        thumb.removeEventListener("pointercancel", finish);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 500);
      };
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", finish);
      thumb.addEventListener("pointercancel", finish);
    });
  }

  document.addEventListener("scroll", event => {
    const target = event.target === document ? document.scrollingElement : event.target;
    if (!eligible(target)) return;
    schedule(target);
  }, { capture: true, passive: true });

  addEventListener("resize", () => activeTarget && schedule(activeTarget), { passive: true });

  new MutationObserver(records => {
    const relevant = records.some(record => {
      if (record.type === "attributes") return record.attributeName === "class" || record.attributeName === "style";
      if (record.target instanceof HTMLStyleElement) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
        && (node.matches("style, link[rel~='stylesheet']") || node.querySelector("style, link[rel~='stylesheet']")));
    });
    if (!relevant) return;
    document.querySelectorAll("[data-mnc-scrollbar]").forEach(element => element.removeAttribute("data-mnc-scrollbar"));
    hide();
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });
})();
