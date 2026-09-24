/*
  All interactions in this HTML preview are local examples. They do not call
  Brightflare's live API or change center data.
*/
const sampleAnswers = [
  {
    terms: /veterans/i,
    answer: "Little Lantern will be closed Wednesday, November 11, 2026, for Veterans Day. Regular care resumes Thursday, November 12.",
    source: "Center update · November 2026 calendar",
    status: "Center-approved answer",
    isHandoff: false,
  },
  {
    terms: /bring|pack|bag/i,
    answer: "Bring a labeled change of clothes, a refillable water bottle, and outerwear for the day's weather. Infants should also have labeled bottles and any needed feeding supplies.",
    source: "Family Handbook · What to bring",
    status: "Center-approved answer",
    isHandoff: false,
  },
  {
    terms: /hours|open|close/i,
    answer: "Little Lantern is open Monday through Friday from 7:30 AM to 5:30 PM. Please pick up your child by closing time.",
    source: "Family Handbook · Hours",
    status: "Center-approved answer",
    isHandoff: false,
  },
  {
    terms: /lunch|meal|snack/i,
    answer: "Little Lantern does not provide lunch. Please pack a labeled lunch and snacks each day, with an ice pack for perishable food.",
    source: "Family Handbook · Meals and nutrition",
    status: "Center-approved answer",
    isHandoff: false,
  },
  {
    terms: /fever|ill|sick|health/i,
    answer: "Children should stay home with a fever of 100.4°F (38°C) or higher, vomiting, diarrhea, or symptoms that prevent them from comfortably joining the day's activities. Call the office if you are unsure.",
    source: "Family Handbook · Health and wellness",
    status: "Center-approved answer",
    isHandoff: false,
  },
];

function setupMotionToggle() {
  const button = document.querySelector("[data-motion-toggle]");
  if (!button) return;
  const isSystemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (isSystemReduced) {
    document.body.classList.add("motion-paused");
    button.textContent = "Motion off (system)";
    button.setAttribute("aria-pressed", "true");
    button.disabled = true;
    return;
  }
  button.addEventListener("click", () => {
    const isPaused = document.body.classList.toggle("motion-paused");
    button.textContent = isPaused ? "Play motion" : "Pause motion";
    button.setAttribute("aria-pressed", String(isPaused));
  });
}

function showSampleAnswer(question) {
  const answerNode = document.querySelector(".answer");
  if (!answerNode) return;
  const match = sampleAnswers.find((item) => item.terms.test(question));
  const answer = match ?? {
    answer: "I don't have an approved center answer to that yet. Please check with the Little Lantern team for the right information.",
    source: "Staff follow-up",
    status: "Staff confirmation needed",
    isHandoff: true,
  };
  answerNode.hidden = false;
  answerNode.classList.toggle("is-handoff", answer.isHandoff);
  answerNode.querySelector("[data-answer-question]").textContent = question;
  answerNode.querySelector("[data-answer-text]").textContent = answer.answer;
  answerNode.querySelector("[data-answer-source]").textContent = answer.source;
  answerNode.querySelector("[data-answer-status]").textContent = answer.status;
  answerNode.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
}

function setupFamilyPreview() {
  const form = document.querySelector(".ask-form");
  const field = form?.querySelector("[name='question']");
  const answerNode = document.querySelector(".answer");
  if (!form || !field || !answerNode) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (!question) return field.focus();
    showSampleAnswer(question);
  });
  document.querySelectorAll("[data-try-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.getAttribute("data-try-question");
      if (!question) return;
      field.value = question;
      showSampleAnswer(question);
    });
  });
  answerNode.querySelector("[data-close-answer]")?.addEventListener("click", () => {
    answerNode.hidden = true;
    field.focus();
  });
}

function setupAdminPreview() {
  const panels = Array.from(document.querySelectorAll("[data-admin-panel]"));
  if (!panels.length) return;
  const viewButtons = Array.from(document.querySelectorAll("[data-admin-view]"));
  const toast = document.querySelector(".admin-toast");
  const editor = document.querySelector(".editor-drawer");
  const draftTitle = editor?.querySelector("[name='title']");
  const draftAnswer = editor?.querySelector("[name='answer']");
  let currentEditTitle = "";

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
  }

  function switchView(view) {
    panels.forEach((panel) => {
      panel.hidden = panel.getAttribute("data-admin-panel") !== view;
    });
    viewButtons.forEach((button) => {
      if (button.getAttribute("data-admin-view") === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const heading = document.querySelector(`[data-admin-panel="${view}"] h2`);
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.getAttribute("data-admin-view")));
  });
  document.querySelectorAll("[data-jump-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.getAttribute("data-jump-view")));
  });

  const topics = {
    "late-pickup": {
      status: "Needs staff answer",
      title: "What is the late pickup fee?",
      summary: "Three families asked about the fee. The handbook draft directs families to the office but does not state a current amount.",
      example: "“What happens if I’m five minutes late?”",
    },
    illness: {
      status: "Needs review",
      title: "When can a child return after illness?",
      summary: "The health handbook covers general symptoms. Staff should check that the current return guidance addresses this recurring question.",
      example: "“Can my child come back after a fever?”",
    },
    lunch: {
      status: "Answered",
      title: "Does the center provide lunch?",
      summary: "The published meals section answers this directly. Families should pack a labeled lunch and snacks.",
      example: "“Do we need to send lunch today?”",
    },
  };
  document.querySelectorAll("[data-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      const topic = topics[button.getAttribute("data-topic")];
      if (!topic) return;
      document.querySelectorAll("[data-topic]").forEach((item) => item.classList.toggle("is-selected", item === button));
      document.querySelector("[data-topic-status]").textContent = topic.status;
      document.querySelector("[data-topic-title]").textContent = topic.title;
      document.querySelector("[data-topic-summary]").textContent = topic.summary;
      document.querySelector("[data-topic-example]").textContent = topic.example;
      const editorButton = document.querySelector(".topic-detail [data-open-editor]");
      editorButton?.setAttribute("data-editor-title", topic.title);
    });
  });
  document.querySelectorAll("[data-open-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      switchView("questions");
      document.querySelector(`[data-topic="${button.getAttribute("data-open-topic")}"]`)?.click();
    });
  });

  const featuredList = document.querySelector(".featured-list");
  function updateFeaturedButtons() {
    if (!featuredList) return;
    const rows = Array.from(featuredList.querySelectorAll("li"));
    rows.forEach((row, index) => {
      row.querySelector('[data-move="up"]').disabled = index === 0;
      row.querySelector('[data-move="down"]').disabled = index === rows.length - 1;
    });
  }
  featuredList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button) return;
    const row = button.closest("li");
    const direction = button.getAttribute("data-move");
    if (direction === "up" && row.previousElementSibling) featuredList.insertBefore(row, row.previousElementSibling);
    if (direction === "down" && row.nextElementSibling) featuredList.insertBefore(row.nextElementSibling, row);
    updateFeaturedButtons();
    showToast("Featured order changed in this preview.");
  });

  document.querySelector(".announcement-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = form.elements.namedItem("title").value.trim();
    const message = form.elements.namedItem("message").value.trim();
    const isActive = form.elements.namedItem("isActive").checked;
    if (isActive && !message) {
      form.elements.namedItem("message").focus();
      showToast("Write a message before showing the announcement.");
      return;
    }
    document.querySelector("[data-announcement-state]").textContent = isActive ? `Showing: ${title || "Center update"}` : "Announcement is off.";
    showToast("Announcement saved in this preview.");
  });
  document.querySelector(".settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    showToast("Center settings saved in this preview.");
  });

  document.querySelectorAll("[data-open-editor]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!editor || !draftTitle || !draftAnswer) return;
      currentEditTitle = button.getAttribute("data-editor-title") ?? "";
      draftTitle.value = currentEditTitle;
      if (/late pickup/i.test(currentEditTitle)) {
        draftAnswer.value = "Please contact the office for the current late pickup fee and let staff know if you are delayed.";
      } else if (/illness/i.test(currentEditTitle)) {
        draftAnswer.value = "Children should stay home with a fever of 100.4°F or higher, vomiting, diarrhea, or symptoms that prevent comfortable participation. Please call the office if you are unsure.";
      } else if (/hour/i.test(currentEditTitle)) {
        draftAnswer.value = "Little Lantern is open Monday through Friday from 7:30 AM to 5:30 PM. Please pick up your child by closing time.";
      } else if (/bring/i.test(currentEditTitle)) {
        draftAnswer.value = "Bring a labeled change of clothes, a refillable water bottle, and weather-ready outerwear.";
      } else {
        draftAnswer.value = "Little Lantern does not provide lunch. Please pack a labeled lunch and snacks each day, with an ice pack for perishable food.";
      }
      editor.showModal();
      draftTitle.focus();
    });
  });
  editor?.querySelector("[data-save-draft]")?.addEventListener("click", () => {
    if (!draftTitle?.reportValidity() || !draftAnswer?.reportValidity()) return;
    if (/lunch/i.test(currentEditTitle)) {
      const recommendation = document.querySelector('[data-recommendation="lunch"]');
      recommendation?.querySelector("h3")?.replaceChildren(document.createTextNode(draftTitle.value.trim()));
      recommendation?.querySelector("p:not(.recommendation-source)")?.replaceChildren(document.createTextNode(draftAnswer.value.trim()));
    }
    editor.close();
    showToast("Draft saved in this preview. Staff review is still required before publishing.");
  });

  document.querySelector("[data-approve-recommendation]")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Approved for family desk";
    document.querySelector('[data-recommendation="lunch"] .mini-status').textContent = "Approved";
    showToast("Lunch answer approved in this preview.");
  });
  document.querySelector("[data-dismiss-recommendation]")?.addEventListener("click", () => {
    document.querySelector('[data-recommendation="lunch"]')?.remove();
    showToast("Recommendation dismissed in this preview.");
  });
}

function setupHandbookPreview() {
  const search = document.querySelector("#handbook-search");
  const buttons = Array.from(document.querySelectorAll("[data-article]"));
  if (!search || !buttons.length) return;
  const articles = {
    hours: {
      title: "Center hours",
      short: "We welcome children from 7:30 AM to 5:30 PM, Monday through Friday.",
      body: "Little Lantern is open Monday through Friday from 7:30 AM to 5:30 PM. Please pick up your child by closing time so our team can finish the daily room close.",
      source: "Family Handbook · Hours",
    },
    tours: {
      title: "Scheduling a tour",
      short: "Family tours are offered Tuesday and Thursday mornings by appointment.",
      body: "Little Lantern offers family tours on Tuesday and Thursday mornings, between 9:00 and 11:30 AM, by appointment. Contact the office to confirm a time and which classrooms are available to visit. A tour does not reserve a space or guarantee enrollment.",
      source: "Family Handbook · Tours and enrollment",
    },
    "daily-routines": {
      title: "What to bring",
      short: "Please bring a labeled change of clothes, a water bottle, and weather-ready outerwear.",
      body: "Bring a labeled change of clothes, a refillable water bottle, and outerwear for the day's weather. Infants should also have labeled bottles and any needed feeding supplies.",
      source: "Family Handbook · What to bring",
    },
    meals: {
      title: "Lunch and snacks",
      short: "Please pack a labeled lunch and snacks each day.",
      body: "Little Lantern does not provide lunch. Please pack a labeled lunch and snacks each day, with an ice pack for perishable food. Send water in a labeled, reusable bottle. If your child has a food allergy or needs a dietary accommodation, contact the office so staff can review the care plan with your family.",
      source: "Family Handbook · Meals and nutrition",
    },
    health: {
      title: "When to stay home",
      short: "Keep your child home for fever, vomiting, or symptoms that prevent comfortable participation.",
      body: "Children should stay home with a fever of 100.4°F (38°C) or higher, vomiting, diarrhea, or symptoms that prevent them from comfortably joining the day's activities. Call the office if you are unsure.",
      source: "Family Handbook · Health and wellness",
    },
    safety: {
      title: "Authorized pickup",
      short: "Only adults listed on your approved pickup list may take your child home.",
      body: "We release children only to adults authorized in the family account. Bring a photo ID if a staff member does not recognize you. Contact the office to update your authorized pickup list.",
      source: "Family Handbook · Safe arrival and pickup",
    },
  };

  function showArticle(key, shouldUpdateHash = true) {
    const article = articles[key];
    if (!article) return;
    buttons.forEach((button) => {
      if (button.getAttribute("data-article") === key) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.querySelector("[data-article-title]").textContent = article.title;
    document.querySelector("[data-article-short]").textContent = article.short;
    document.querySelector("[data-article-body]").textContent = article.body;
    document.querySelector("[data-article-source]").textContent = article.source;
    if (shouldUpdateHash) window.history.replaceState(null, "", `#${key}`);
    document.querySelector("[data-article-title]").focus({ preventScroll: true });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => showArticle(button.getAttribute("data-article")));
  });
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;
    buttons.forEach((button) => {
      const key = button.getAttribute("data-article");
      const article = articles[key];
      const isVisible = !query || `${button.textContent} ${article?.short ?? ""} ${article?.body ?? ""}`.toLowerCase().includes(query);
      button.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });
    document.querySelectorAll(".handbook-group").forEach((group) => {
      group.hidden = !Array.from(group.querySelectorAll("[data-article]")).some((button) => !button.hidden);
    });
    document.querySelector(".handbook-empty").hidden = visibleCount !== 0;
  });
  window.addEventListener("hashchange", () => showArticle(decodeURIComponent(window.location.hash.slice(1)), false));
  const initialKey = decodeURIComponent(window.location.hash.slice(1));
  if (articles[initialKey]) showArticle(initialKey, false);
}

setupMotionToggle();
setupFamilyPreview();
setupAdminPreview();
setupHandbookPreview();
