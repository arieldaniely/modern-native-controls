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
    if (!activeTarget || !activeTarget.isConnected || ignored(activeTarget)) return hide();
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
    if (!(target instanceof Element) || ignored(target)) return;
    schedule(target);
  }, { capture: true, passive: true });

  addEventListener("resize", () => activeTarget && schedule(activeTarget), { passive: true });
})();
