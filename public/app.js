(() => {
  const root = document.documentElement;
  const toggles = document.querySelectorAll("[data-theme-toggle]");
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function currentTheme() {
    if (root.dataset.theme === "light" || root.dataset.theme === "dark") {
      return root.dataset.theme;
    }
    return media.matches ? "dark" : "light";
  }

  function syncLabels() {
    const label = currentTheme() === "dark" ? "切换到浅色主题" : "切换到深色主题";
    toggles.forEach((button) => {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    });
  }

  toggles.forEach((button) => {
    button.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        // Ignore unavailable storage.
      }
      syncLabels();
    });
  });

  media.addEventListener("change", syncLabels);
  syncLabels();

  const navToggle = document.querySelector("[data-nav-toggle]");
  const sidebar = document.getElementById("site-sidebar");
  const navMedia = window.matchMedia("(max-width: 860px)");
  let navReturnFocus = null;

  function navIsOpen() {
    return document.body.classList.contains("nav-open");
  }

  function setNav(open) {
    if (!navToggle || !sidebar) return;

    document.body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "关闭目录" : "打开目录");

    if (open) {
      const active = document.activeElement;
      navReturnFocus =
        active instanceof HTMLElement && active !== document.body
          ? active
          : navToggle;
      const closeButton = sidebar.querySelector("[data-nav-close]");
      if (closeButton instanceof HTMLElement) {
        closeButton.focus({ preventScroll: true });
      }
    } else if (navReturnFocus instanceof HTMLElement) {
      navReturnFocus.focus({ preventScroll: true });
      navReturnFocus = null;
    }
  }

  navToggle?.addEventListener("click", () => setNav(!navIsOpen()));
  document.querySelectorAll("[data-nav-close]").forEach((button) => {
    button.addEventListener("click", () => setNav(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navIsOpen()) {
      event.preventDefault();
      setNav(false);
    }
  });
  sidebar?.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !navIsOpen()) return;

    const focusable = Array.from(
      sidebar.querySelectorAll("a[href], button:not([disabled])"),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  navMedia.addEventListener("change", (event) => {
    if (!event.matches) setNav(false);
  });

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const message = form.dataset.confirm || "确定继续？";
      if (!window.confirm(message)) event.preventDefault();
    });
  });

  const editor = document.querySelector(".textarea--editor");
  const editorForm = editor ? editor.closest("form") : null;

  if (editor) {
    const field = editor.closest(".field");
    const hint = field ? field.querySelector(".hint") : null;
    if (hint) {
      const counter = document.createElement("span");
      counter.className = "char-count";
      const updateCounter = () => {
        counter.textContent = `${editor.value.length} 字符`;
      };
      updateCounter();
      hint.appendChild(counter);
      editor.addEventListener("input", updateCounter);
    }

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editorForm instanceof HTMLFormElement) editorForm.requestSubmit();
      }
    });
  }
})();
