function toggleMenu() {
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");

    if (!menu || !icon) return;

    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

document.addEventListener("DOMContentLoaded", () => {
    // -----------------------------
    // 1) Scroll reveal animations
    // -----------------------------
    const revealSelectors = [
        ".section-heading-glass",
        ".section__text.glass-panel",
        ".details-container",
        ".text-container p",
        ".contact-info-upper-container",
        "footer"
    ];

    const revealTargets = document.querySelectorAll(revealSelectors.join(", "));

    revealTargets.forEach((el, index) => {
        el.classList.add("reveal");

        // small stagger, repeats every 6 items
        const stagger = (index % 6) * 70;
        el.style.setProperty("--reveal-delay", `${stagger}ms`);
    });

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target); // reveal once
                }
            });
        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));

    // -----------------------------
    // 2) Active nav highlight
    // -----------------------------
    const sections = document.querySelectorAll("section[id]");
    const allNavLinks = document.querySelectorAll(
        '#desktop-nav a[href^="#"], #hamburger-nav a[href^="#"]'
    );

    const navMap = new Map();
    allNavLinks.forEach((link) => {
        const id = link.getAttribute("href");
        if (!navMap.has(id)) navMap.set(id, []);
        navMap.get(id).push(link);
    });

    let currentSectionId = "#profile";

    const setActiveNav = (id) => {
        if (!id) return;
        currentSectionId = id;

        allNavLinks.forEach((link) => link.classList.remove("active-link"));

        const matching = navMap.get(id);
        if (matching) {
            matching.forEach((link) => link.classList.add("active-link"));
        }
    };

    // Set active from hash on load (if any)
    if (window.location.hash && navMap.has(window.location.hash)) {
        setActiveNav(window.location.hash);
    }

    const sectionObserver = new IntersectionObserver(
        (entries) => {
            // pick the most visible section currently in view
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

            if (visible.length) {
                setActiveNav(`#${visible[0].target.id}`);
            }
        },
        {
            threshold: [0.2, 0.35, 0.5, 0.7],
            rootMargin: "-10% 0px -45% 0px"
        }
    );

    sections.forEach((section) => sectionObserver.observe(section));

    // Keep nav active when clicking links immediately
    allNavLinks.forEach((link) => {
        link.addEventListener("click", () => {
            const id = link.getAttribute("href");
            setActiveNav(id);
        });
    });
});