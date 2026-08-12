(() => {
  "use strict";

  const runtimeMarker = "data-mnc-style-guard-runtime";
  if (document.documentElement.hasAttribute(runtimeMarker)) return;
  document.documentElement.setAttribute(runtimeMarker, "");

  const visualProperties = new Set([
    "appearance", "-webkit-appearance", "background", "background-color", "background-image",
    "border", "border-color", "border-radius", "border-style", "border-width", "box-shadow",
    "color", "font", "font-family", "font-size", "font-weight", "padding", "padding-inline",
    "padding-block", "outline"
  ]);
  const controlSelector = "select, input[type='date'], input[type='file'], input[type='color'], input[type='checkbox'], input[type='radio'], button, input[type='button'], input[type='submit'], input[type='reset']";

  function extensionRule(rule) {
    for (let parent = rule; parent; parent = parent.parentRule) {
      if (parent.name === "modern-native-controls") return true;
    }
    return false;
  }

  function hasVisualDeclaration(style) {
    if (!style) return false;
    return [...style].some(property => visualProperties.has(property)
      || property.startsWith("border-") || property.startsWith("background-"));
  }

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

  function selectorMatches(selectorText, element, pseudo) {
    for (const rawSelector of splitSelectors(selectorText)) {
      const pseudoIndex = pseudo ? rawSelector.indexOf(pseudo) : -1;
      if (pseudo && pseudoIndex < 0) continue;
      if (!pseudo && rawSelector.includes("::")) continue;
      const selector = (pseudo ? rawSelector.slice(0, pseudoIndex) : rawSelector).trim() || "*";
      try {
        if (element.matches(selector)) return true;
      } catch {}
    }
    return false;
  }

  function matchingRule(rules, element, pseudo = "") {
    for (const rule of rules) {
      if (rule.cssRules && matchingRule(rule.cssRules, element, pseudo)) return true;
      if (!rule.selectorText || extensionRule(rule) || !hasVisualDeclaration(rule.style)) continue;
      if (selectorMatches(rule.selectorText, element, pseudo)) return true;
    }
    return false;
  }

  function authored(element, pseudo = "") {
    if (!pseudo && hasVisualDeclaration(element.style)) return true;
    for (const sheet of document.styleSheets) {
      try {
        if (matchingRule(sheet.cssRules, element, pseudo)) return true;
      } catch {}
    }
    return false;
  }

  function authoredOption(select) {
    return [...select.options].some(option => authored(option));
  }

  function markElement(element) {
    element.toggleAttribute("data-mnc-authored", authored(element));
    if (element instanceof HTMLSelectElement) {
      element.toggleAttribute("data-mnc-picker-authored", authored(element, "::picker(select)")
        || authored(element, "::picker-icon") || authoredOption(element));
    }
    if (element instanceof HTMLInputElement && element.type === "date") {
      element.toggleAttribute("data-mnc-date-indicator-authored", authored(element, "::-webkit-calendar-picker-indicator"));
    }
    if (element instanceof HTMLInputElement && element.type === "file") {
      element.toggleAttribute("data-mnc-file-button-authored", authored(element, "::file-selector-button"));
    }
    if (element instanceof HTMLInputElement && element.type === "color") {
      element.toggleAttribute("data-mnc-color-swatch-authored", authored(element, "::-webkit-color-swatch")
        || authored(element, "::-moz-color-swatch"));
    }
  }

  function mark(root = document) {
    if (root instanceof Element && root.matches(controlSelector)) markElement(root);
    root.querySelectorAll?.(controlSelector).forEach(markElement);
  }

  globalThis.ModernNativeControlsStyleGuard = { authored };
  mark();
  const pendingRoots = new Set();
  let scheduled = false;
  function scheduleMark(root) {
    pendingRoots.add(root);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (pendingRoots.has(document)) mark();
      else pendingRoots.forEach(mark);
      pendingRoots.clear();
    });
  }
  new MutationObserver(records => {
    for (const record of records) {
      if (record.target instanceof HTMLStyleElement
        || [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
          && (node.matches("style, link[rel~='stylesheet']") || node.querySelector("style, link[rel~='stylesheet']")))) {
        scheduleMark(document);
        continue;
      }
      if (record.type === "attributes") mark(record.target);
      else record.addedNodes.forEach(node => {
        if (node instanceof Element) mark(node);
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
})();
