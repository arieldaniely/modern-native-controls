(() => {
  "use strict";
  const root = document.documentElement;
  const saved = localStorage.getItem("mnc-site-theme");
  root.dataset.theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  function syncFrames() {
    document.querySelectorAll("iframe").forEach(frame => {
      frame.contentWindow?.postMessage({ type: "theme", value: root.dataset.theme }, "*");
    });
  }

  document.querySelector(".theme-button").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("mnc-site-theme", root.dataset.theme);
    document.querySelector('meta[name="theme-color"]').content = root.dataset.theme === "dark" ? "#0b0e13" : "#f7f8fb";
    syncFrames();
  });

  document.querySelectorAll("iframe").forEach(frame => frame.addEventListener("load", syncFrames));
  const topbar = document.querySelector(".topbar");
  addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 18), { passive: true });

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach(element => observer.observe(element));
})();
