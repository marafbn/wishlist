(function () {
  const D = window.WishlistData;
  const steps = [...document.querySelectorAll(".quiz-step")];
  const quizPanel = document.querySelector("#quiz-panel");
  const resultsPanel = document.querySelector("#results");
  const resultsGrid = document.querySelector("#results-grid");
  const next = document.querySelector("#next-button");
  const back = document.querySelector("#back-button");
  const error = document.querySelector("#quiz-error");
  let current = 0;

  const ranges = {
    "5-10": [5, 10],
    "10-15": [10, 15],
    "15-20": [15, 20],
    "20-25": [20, 25],
    "30-50": [30, 50],
    "50-100": [50, 100],
    "100-plus": [100, Infinity],
  };

  function value(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function showStep() {
    quizPanel.classList.toggle("has-tree-background", current === 0);
    quizPanel.classList.toggle("has-candle-background", current === 1);
    quizPanel.classList.toggle("has-moon-background", current === 2);

    steps.forEach((step, index) => {
      step.classList.toggle("is-hidden", index !== current);
    });

    document.querySelector("#step-number").textContent = String(current + 1);

    const percent = Math.round(((current + 1) / steps.length) * 100);
    document.querySelector("#progress-bar").style.width = `${percent}%`;
    document.querySelector("#progress-percent").textContent = `${percent}%`;

    back.hidden = current === 0;
    next.textContent = current === steps.length - 1 ? "Ideen anzeigen" : "Weiter";
    error.textContent = "";
  }

  function findWishes() {
    const person = value("audience");
    const [min, max] = ranges[value("budget")];
    const style = value("gift-style");

    const available = D.getWishes().filter((wish) => {
      if (wish.status !== "available") return false;

      const audiences = Array.isArray(wish.audience) ? wish.audience : [];

      if (person === "weitere") {
        return audiences.includes("weitere");
      }

      if (person === "mom") {
        return (
          audiences.includes("mom") ||
          audiences.includes("familie") ||
          audiences.includes("alle")
        );
      }

      return audiences.includes("alle") || audiences.includes(person);
    });

    if (style === "mehrere-kleine") {
      // Budget-Limit gilt für jeden Wunsch einzeln, nicht für die Summe.
      // So können mehrere passende Vorschläge zusammen über dem Budget liegen.
      const chosen = available
        .filter((wish) => wish.giftType === "small" && Number(wish.price) <= max)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 4);

      const total = chosen.reduce((sum, wish) => sum + Number(wish.price || 0), 0);
      return { style, wishes: chosen, total };
    }

    const type = style === "ein-grosses" ? "large" : "group";
    const matches = available.filter(
      (wish) =>
        wish.giftType === type &&
        Number(wish.price) >= min &&
        Number(wish.price) <= max,
    );

    const total = matches.reduce((sum, wish) => sum + Number(wish.price || 0), 0);
    return { style, wishes: matches, total };
  }

  async function showResults() {
    try {
      if (window.wishlistSupabase) {
        await D.loadWishesFromSupabase();
      }

      const result = findWishes();
      quizPanel.classList.add("is-hidden");
      resultsPanel.classList.remove("is-hidden");

      const title = document.querySelector("#results-title");
      const note = document.querySelector("#results-note");

      title.textContent =
        result.style === "mehrere-kleine"
          ? "Kleinere Geschenkideen"
          : result.style === "gemeinsam"
            ? "Ideen zum Zusammenschenken"
            : "Größere Geschenkideen";

      note.textContent = result.wishes.length
        ? result.style === "mehrere-kleine"
          ? `Jeder Wunsch liegt einzeln innerhalb der Budget-Obergrenze. Der Gesamtwert dieser Vorschläge beträgt ${D.money(result.total)} und kann über deinem Budget liegen.`
          : `Diese Auswahl kostet insgesamt ${D.money(result.total)}.`
        : "Zu dieser Kombination gibt es gerade keine passenden Wünsche. Gehe zurück und wähle ein anderes Budget oder eine andere Geschenkart.";

      resultsGrid.innerHTML = result.wishes.length
        ? result.wishes
            .map((wish) => window.WishlistUI.wishCard(wish))
            .join("")
        : `<div class="empty-state">Keine passenden Wünsche gefunden. Du kannst alle Wünsche auf der Übersicht ansehen.</div>`;

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Quiz-Wünsche konnten nicht geladen werden:", error);

      quizPanel.classList.add("is-hidden");
      resultsPanel.classList.remove("is-hidden");
      document.querySelector("#results-title").textContent =
        "Geschenkideen konnten nicht geladen werden";
      document.querySelector("#results-note").textContent =
        "Bitte lade die Seite neu und versuche es erneut.";
      resultsGrid.innerHTML = "";
    }
  }

  next.addEventListener("click", () => {
    const names = ["audience", "budget", "gift-style"];

    if (!value(names[current])) {
      error.textContent = "Bitte wähle eine Antwort aus, bevor du weitergehst.";
      return;
    }

    if (current < steps.length - 1) {
      current += 1;
      showStep();
    } else {
      showResults();
    }
  });

  back.addEventListener("click", () => {
    if (current > 0) {
      current -= 1;
      showStep();
    }
  });

  document.querySelector("#restart-button").addEventListener("click", () => {
    document.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.checked = false;
    });

    current = 0;
    resultsPanel.classList.add("is-hidden");
    quizPanel.classList.remove("is-hidden");
    showStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("wishlist:updated", () => {
    if (!resultsPanel.classList.contains("is-hidden")) {
      showResults();
    }
  });

  showStep();
})();
