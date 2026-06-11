(function () {
  "use strict";

  /* ===== Плавная смена фона/тени header при скролле ===== */
  const header = document.getElementById("header");
  if (header) {
    let ticking = false;
    const SCROLL_THRESHOLD = 8;
    function updateHeader() {
      header.classList.toggle("is-scrolled", window.scrollY > SCROLL_THRESHOLD);
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(updateHeader);
        }
      },
      { passive: true }
    );
    updateHeader();
  }

  /* ===== Гамбургер-меню ===== */
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const overlay = document.getElementById("menuOverlay");

  if (!burger || !nav || !overlay) return;

  let lastFocused = null;

  function openMenu() {
    lastFocused = document.activeElement;
    nav.classList.add("is-open");
    burger.classList.add("is-open");
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Закрыть меню");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    // перевести фокус в меню (для мыши :focus-visible не сработает — кольца не будет)
    const firstLink = nav.querySelector(".nav__link");
    if (firstLink) firstLink.focus();
  }

  function closeMenu() {
    nav.classList.remove("is-open");
    burger.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Открыть меню");
    overlay.hidden = true;
    document.body.style.overflow = "";
    // вернуть фокус туда, откуда открыли (или на бургер)
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    } else {
      burger.focus();
    }
  }

  function toggleMenu() {
    if (nav.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  burger.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", closeMenu);

  // close on link click (navigation within page)
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeMenu();
  });

  // Escape закрывает; Tab «зациклен» внутри открытого меню (focus trap)
  document.addEventListener("keydown", function (e) {
    if (!nav.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      closeMenu();
      return;
    }
    if (e.key === "Tab") {
      const focusables = [burger].concat(
        Array.prototype.slice.call(nav.querySelectorAll("a[href]"))
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // reset menu state when resizing back to desktop
  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth > 768 && nav.classList.contains("is-open")) {
        closeMenu();
      }
    }, 120);
  });
})();

/* ===== Карусели (4-й блок — кейсы, 7-й блок — отзывы на мобиле) ===== */
(function () {
  "use strict";

  function initCarousel(slider, cardSelector, prev, next) {
    if (!slider) return;

    function scrollable() {
      return slider.scrollWidth - slider.clientWidth > 1;
    }

    function step() {
      const card = slider.querySelector(cardSelector);
      if (!card) return slider.clientWidth;
      const gap = parseFloat(getComputedStyle(slider).columnGap) || 16;
      return card.getBoundingClientRect().width + gap;
    }

    function updateArrows() {
      const maxScroll = slider.scrollWidth - slider.clientWidth - 1;
      if (prev) prev.disabled = slider.scrollLeft <= 0;
      if (next) next.disabled = slider.scrollLeft >= maxScroll;
    }

    if (prev) {
      prev.addEventListener("click", function () {
        slider.scrollBy({ left: -step(), behavior: "smooth" });
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        slider.scrollBy({ left: step(), behavior: "smooth" });
      });
    }

    slider.addEventListener("scroll", function () {
      window.requestAnimationFrame(updateArrows);
    });
    window.addEventListener("resize", updateArrows);
    updateArrows();

    /* --- перетаскивание мышью (drag-to-scroll) --- */
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    slider.addEventListener("pointerdown", function (e) {
      // только мышь (тач скроллит нативно) и только если есть что листать
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (!scrollable()) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = slider.scrollLeft;
      slider.classList.add("is-dragging");
      slider.setPointerCapture(e.pointerId);
    });

    slider.addEventListener("pointermove", function (e) {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      slider.scrollLeft = startScroll - dx;
    });

    function endDrag(e) {
      if (!isDown) return;
      isDown = false;
      slider.classList.remove("is-dragging");
      if (e.pointerId != null && slider.hasPointerCapture(e.pointerId)) {
        slider.releasePointerCapture(e.pointerId);
      }
    }

    slider.addEventListener("pointerup", endDrag);
    slider.addEventListener("pointercancel", endDrag);

    // не давать клику «срабатывать» после перетаскивания
    slider.addEventListener(
      "click",
      function (e) {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      },
      true
    );
  }

  // 4-й блок — кейсы: разметка статична в index.html
  initCarousel(
    document.getElementById("casesSlider"),
    ".case",
    document.querySelector('.cases__arrow[data-dir="prev"]'),
    document.querySelector('.cases__arrow[data-dir="next"]')
  );

  /* ===== Контент из CMS: отзывы и «СМИ о нас» рендерятся из JSON =====
     Источник правды — content/reviews.json и content/press.json
     (их редактирует CMS). Здесь они подтягиваются и строится разметка. */

  function renderReviews(items) {
    const grid = document.getElementById("reviewsSlider");
    if (!grid || !Array.isArray(items)) return;
    grid.textContent = "";
    items.forEach(function (r) {
      const card = document.createElement("article");
      card.className = "reviews__card";

      const text = document.createElement("p");
      text.className = "reviews__text";
      text.textContent = r.text || "";
      card.appendChild(text);

      const author = document.createElement("div");
      author.className = "reviews__author";

      const avatar = document.createElement("img");
      avatar.className = "reviews__avatar";
      avatar.src = r.avatar || "";
      avatar.alt = r.name || "";
      avatar.width = 72;
      avatar.height = 72;
      avatar.loading = "lazy";
      author.appendChild(avatar);

      const person = document.createElement("div");
      person.className = "reviews__person";

      const name = document.createElement("p");
      name.className = "reviews__name";
      name.textContent = r.name || "";
      person.appendChild(name);

      const role = document.createElement("p");
      role.className = "reviews__role";
      role.textContent = r.role || "";
      person.appendChild(role);

      author.appendChild(person);
      card.appendChild(author);
      grid.appendChild(card);
    });
  }

  function renderPress(items) {
    const grid = document.getElementById("pressGrid");
    if (!grid || !Array.isArray(items)) return;
    grid.textContent = "";
    items.forEach(function (p) {
      const card = document.createElement("a");
      card.className = "press__card" + (p.big ? " press__card--big" : "");
      card.href = p.url || "#";

      const img = document.createElement("img");
      img.className = "press__img";
      img.src = p.image || "";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "lazy";
      card.appendChild(img);

      const caption = document.createElement("p");
      caption.className = "press__caption";
      caption.textContent = p.caption || "";
      card.appendChild(caption);

      grid.appendChild(card);
    });
  }

  function loadJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(url + " → HTTP " + res.status);
      return res.json();
    });
  }

  loadJSON("content/reviews.json")
    .then(function (data) {
      renderReviews((data && data.items) || []);
      // карусель отзывов на мобиле — инициализируем ПОСЛЕ рендера карточек
      initCarousel(
        document.getElementById("reviewsSlider"),
        ".reviews__card",
        null,
        null
      );
    })
    .catch(function (err) {
      console.warn("[HR] Не удалось загрузить отзывы:", err);
    });

  loadJSON("content/press.json")
    .then(function (data) {
      renderPress((data && data.items) || []);
    })
    .catch(function (err) {
      console.warn("[HR] Не удалось загрузить блок «СМИ о нас»:", err);
    });
})();
