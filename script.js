const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-nav");
const mobileLinks = document.querySelectorAll(".mobile-nav a");
const allNavLinks = document.querySelectorAll(".nav-links a, .mobile-nav a");
const revealItems = document.querySelectorAll(".reveal");
const rotatingRole = document.querySelector("#rotating-role");
const roleOptions = [
  "Software Engineering Student",
  "Backend Developer",
  "CSUN Computer Science Student",
  "Building Real Projects",
];

if (menuToggle && mobileMenu) {
  const setMenuState = (isOpen) => {
    mobileMenu.classList.toggle("open", isOpen);
    menuToggle.classList.toggle("active", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  };

  menuToggle.addEventListener("click", () => {
    const open = !mobileMenu.classList.contains("open");
    setMenuState(open);
  });

  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => setMenuState(false));
  });
}

if (rotatingRole) {
  let roleIndex = 0;
  window.setInterval(() => {
    roleIndex = (roleIndex + 1) % roleOptions.length;
    rotatingRole.textContent = roleOptions[roleIndex];
  }, 2600);
}

if ("IntersectionObserver" in window && allNavLinks.length > 0) {
  const sectionIds = Array.from(allNavLinks)
    .map((link) => link.getAttribute("href"))
    .filter((href) => href && href.startsWith("#"))
    .map((href) => href.slice(1));

  const uniqueSectionIds = [...new Set(sectionIds)];
  const sections = uniqueSectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const setActiveLink = (activeId) => {
    allNavLinks.forEach((link) => {
      const target = link.getAttribute("href");
      const isActive = target === `#${activeId}`;
      link.classList.toggle("is-active", isActive);
      if (link.closest(".mobile-nav")) {
        link.setAttribute("aria-current", isActive ? "page" : "false");
      }
    });
  };

  const navObserver = new IntersectionObserver(
    (entries) => {
      let mostVisible = null;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!mostVisible || entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        }
      });

      if (mostVisible) {
        setActiveLink(mostVisible.target.id);
      }
    },
    {
      rootMargin: "-40% 0px -45% 0px",
      threshold: [0.2, 0.4, 0.6, 0.8],
    }
  );

  sections.forEach((section) => navObserver.observe(section));
  if (sections[0]) {
    setActiveLink(sections[0].id);
  }
}

if ("IntersectionObserver" in window && revealItems.length > 0) {
  const observer = new IntersectionObserver(
    (entries, io) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}