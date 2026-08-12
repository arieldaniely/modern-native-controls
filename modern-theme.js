(() => {
  "use strict";

  const runtimeMarker = "data-mnc-theme-runtime";
  if (document.documentElement.hasAttribute(runtimeMarker)) return;
  document.documentElement.setAttribute(runtimeMarker, "");

  const root = document.documentElement;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const watchedVariables = [
    "--color-primary", "--primary-color", "--primary", "--accent-color", "--accent",
    "--brand-color", "--brand-primary", "--bs-primary", "--link-color",
    "--mui-palette-primary-main", "--chakra-colors-blue-500"
  ];
  let scheduled = false;
  let bodyObserver;

  function parseColor(value) {
    if (!value || value === "auto" || value === "transparent" || !CSS.supports("color", value)) return null;
    const probe = document.createElement("span");
    probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;color:${value}`;
    (document.body || root).append(probe);
    const match = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.remove();
    if (!match || (match.length > 3 && +match[3] === 0)) return null;
    return match.slice(0, 3).map(Number);
  }

  function mix(first, second, weight) {
    return first.map((value, index) => Math.round(value * (1 - weight) + second[index] * weight));
  }

  function color(value, alpha) {
    return alpha === undefined ? `rgb(${value.join(" ")})` : `rgb(${value.join(" ")} / ${alpha})`;
  }

  function luminance(rgb) {
    const values = rgb.map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  }

  function contrast(first, second) {
    const high = Math.max(luminance(first), luminance(second));
    const low = Math.min(luminance(first), luminance(second));
    return (high + .05) / (low + .05);
  }

  function chroma(rgb) {
    return Math.max(...rgb) - Math.min(...rgb);
  }

  function findBackground() {
    for (const element of [document.body, root]) {
      if (!element) continue;
      const parsed = parseColor(getComputedStyle(element).backgroundColor);
      if (parsed) return parsed;
    }
    return darkQuery.matches ? [28, 28, 30] : [255, 255, 255];
  }

  function findAccent(styles, surface) {
    const accent = parseColor(styles.accentColor);
    if (accent && chroma(accent) > 22 && contrast(accent, surface) > 1.35) return accent;

    for (const variable of watchedVariables) {
      const candidate = parseColor(styles.getPropertyValue(variable).trim());
      if (candidate && chroma(candidate) > 22 && contrast(candidate, surface) > 1.35) return candidate;
    }

    const themed = parseColor(document.querySelector('meta[name="theme-color"]')?.content);
    if (themed && chroma(themed) > 22 && contrast(themed, surface) > 1.35) return themed;

    const link = document.querySelector("a[href]");
    const linkColor = link && parseColor(getComputedStyle(link).color);
    if (linkColor && chroma(linkColor) > 22 && contrast(linkColor, surface) > 1.35) return linkColor;
    return darkQuery.matches ? [10, 132, 255] : [10, 122, 255];
  }

  function applyTheme() {
    scheduled = false;
    const body = document.body;
    const styles = getComputedStyle(body || root);
    const background = findBackground();
    const isDark = luminance(background) < .32;
    const fallbackText = isDark ? [245, 245, 247] : [29, 29, 31];
    let text = parseColor(styles.color) || fallbackText;
    if (contrast(text, background) < 3) text = fallbackText;

    const surface = isDark ? mix(background, [255, 255, 255], .075) : mix(background, [255, 255, 255], .72);
    const accent = findAccent(styles, surface);
    const accentHover = isDark ? mix(accent, [255, 255, 255], .12) : mix(accent, [0, 0, 0], .12);
    const muted = mix(text, surface, .44);
    const hover = mix(surface, accent, isDark ? .12 : .065);
    const selected = mix(surface, accent, isDark ? .24 : .13);
    const onAccent = contrast([255, 255, 255], accent) >= 3 ? [255, 255, 255] : [0, 0, 0];

    const values = {
      "--mnc-site-accent": color(accent),
      "--mnc-site-accent-hover": color(accentHover),
      "--mnc-site-on-accent": color(onAccent),
      "--mnc-site-background": color(background),
      "--mnc-site-surface": color(surface, .97),
      "--mnc-site-surface-solid": color(surface),
      "--mnc-site-hover": color(hover),
      "--mnc-site-selected": color(selected),
      "--mnc-site-text": color(text),
      "--mnc-site-muted": color(muted),
      "--mnc-site-border": color(text, isDark ? .2 : .16),
      "--mnc-site-border-hover": color(text, isDark ? .34 : .28),
      "--mnc-site-ring": color(accent, .24),
      "--mnc-site-shadow": color([0, 0, 0], isDark ? .48 : .18),
      "--mnc-site-dark": isDark ? "1" : "0"
    };
    for (const [name, value] of Object.entries(values)) {
      if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
    }
    const themeName = isDark ? "dark" : "light";
    if (root.dataset.mncTheme !== themeName) root.dataset.mncTheme = themeName;

    if (body && !bodyObserver) {
      bodyObserver = new MutationObserver(schedule);
      bodyObserver.observe(body, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-mode"] });
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyTheme);
  }

  new MutationObserver(schedule).observe(root, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-mode"]
  });
  darkQuery.addEventListener?.("change", schedule);
  document.addEventListener("DOMContentLoaded", schedule, { once: true });
  applyTheme();
})();
