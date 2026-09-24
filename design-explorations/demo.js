/*
  Static interactions for the three visual prototypes. The fictional answers
  below demonstrate states and are not connected to the Brightflare backend.
*/
const exampleAnswers = [
  {
    terms: /hour|open|close|time/i,
    answer: "Little Lantern Learning Center is open Monday through Friday, 7:30 AM to 5:30 PM. If your family's schedule is changing, please let the center team know directly.",
    source: "Center details · reviewed September 2026",
    status: "From the center handbook",
    isHandoff: false,
  },
  {
    terms: /pack|bring|bag|lunch/i,
    answer: "Bring a labeled change of clothes and your child's usual daily essentials. Your classroom team can confirm the current list for your child's age group.",
    source: "Getting ready for school · example content",
    status: "Check with your classroom team",
    isHandoff: true,
  },
  {
    terms: /sick|ill|fever|health/i,
    answer: "Health questions can depend on the situation. Please check the center's current health guidance and speak with staff before returning after an illness.",
    source: "Health and wellness · example content",
    status: "Staff can confirm the next step",
    isHandoff: true,
  },
];

function showAnswer(question, answerNode) {
  const match = exampleAnswers.find((item) => item.terms.test(question));
  const answer = match ?? {
    answer: "I don't have a center-approved answer to that yet. A member of the Little Lantern team can help you confirm the right information.",
    source: "Staff follow-up",
    status: "Needs a staff answer",
    isHandoff: true,
  };

  answerNode.hidden = false;
  answerNode.querySelector("[data-answer-question]").textContent = question;
  answerNode.querySelector("[data-answer-text]").textContent = answer.answer;
  answerNode.querySelector("[data-answer-source]").textContent = answer.source;
  answerNode.querySelector("[data-answer-status]").textContent = answer.status;
  answerNode.classList.toggle("is-handoff", answer.isHandoff);
  answerNode.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
}

function setupDemo() {
  const navigation = document.querySelector(".demo-nav");
  if (navigation) {
    const motionToggle = document.createElement("button");
    motionToggle.type = "button";
    motionToggle.className = "motion-toggle";
    motionToggle.textContent = "Pause motion";
    motionToggle.setAttribute("aria-pressed", "false");
    navigation.append(motionToggle);
    const isSystemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isSystemReduced) {
      document.body.classList.add("motion-paused");
      motionToggle.textContent = "Motion off (system)";
      motionToggle.setAttribute("aria-pressed", "true");
      motionToggle.disabled = true;
    }
    motionToggle.addEventListener("click", () => {
      const isPaused = document.body.classList.toggle("motion-paused");
      motionToggle.setAttribute("aria-pressed", String(isPaused));
      motionToggle.textContent = isPaused ? "Play motion" : "Pause motion";
    });
  }

  const form = document.querySelector(".ask-form");
  const field = form?.querySelector("[name='question']");
  const answerNode = document.querySelector(".answer");
  if (!form || !field || !answerNode) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = field.value.trim();
    if (!question) {
      field.focus();
      return;
    }
    showAnswer(question, answerNode);
  });

  document.querySelectorAll("[data-try-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.getAttribute("data-try-question");
      if (!question) return;
      field.value = question;
      showAnswer(question, answerNode);
    });
  });

  document.querySelectorAll("[data-close-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      answerNode.hidden = true;
      field.focus();
    });
  });
}

setupDemo();
