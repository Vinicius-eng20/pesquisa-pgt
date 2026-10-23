document.addEventListener("click", function (event) {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".menu-toggle");

  if (!document.body.classList.contains("menu-open")) return;
  if (!nav || !toggle) return;

  if (!nav.contains(event.target) && !toggle.contains(event.target)) {
    document.body.classList.remove("menu-open");
  }
});
