(() => {
  // Active nav link
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });

  // Mobile menu toggle
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".navlinks");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  // Close menu when clicking a link (mobile UX improvement)
  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
    });
  });
})();