(() => {
  const navItems = document.querySelectorAll(".nav-item");
  const screens = document.querySelectorAll(".screen");

  function showScreen(id) {
    screens.forEach((s) => s.classList.toggle("active", s.dataset.screen === id));
    navItems.forEach((n) => n.classList.toggle("active", n.dataset.target === id));
    window.location.hash = id;
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.dataset.target));
  });

  const initial = window.location.hash.replace("#", "") || "dashboard";
  const valid = Array.from(screens).some((s) => s.dataset.screen === initial);
  showScreen(valid ? initial : "dashboard");
})();
