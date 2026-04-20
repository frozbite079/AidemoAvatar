const speechCard = document.getElementById("speechCard");
const playGreetingButton = document.getElementById("playGreeting");
const fileInput = document.getElementById("fileInput");
const uploadResult = document.getElementById("uploadResult");
const chatThread = document.getElementById("chatThread");
const chatComposer = document.getElementById("chatComposer");
const chatInput = document.getElementById("chatInput");
const promptChips = document.querySelectorAll(".prompt-chip");
const deliveryForm = document.getElementById("deliveryForm");
const statusCard = document.getElementById("statusCard");

const greetingText =
  "Hello, I’m Musaed your AI assistant. Upload a file and ask me anything about it.";

const cannedResponses = {
  "Summarize the file":
    "This demo presents Musaed as a modern AI avatar assistant that can ingest files, answer questions, and help deliver follow-up messages.",
  "Extract key points":
    "Key points include a human-like avatar interface, support for file uploads, voice-and-text Q&A, and outbound delivery through email and WhatsApp.",
  "Prepare a follow-up":
    "Here is a sample follow-up: Thank you for reviewing the Musaed demo. We can tailor the assistant for your workflow, documents, and outreach channels.",
};

function appendBubble(content, type) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type === "user" ? "bubble-user" : "bubble-assistant"}`;
  bubble.textContent = content;
  chatThread.appendChild(bubble);
  chatThread.scrollTop = chatThread.scrollHeight;
}

playGreetingButton.addEventListener("click", () => {
  speechCard.querySelector(".speech-text").textContent = greetingText;
  statusCard.querySelector(".insight-value").textContent =
    "Greeting preview triggered in the UI.";
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  uploadResult.innerHTML = `
    <p class="upload-state"><strong>${file.name}</strong> selected. Demo status: document ready for indexing preview.</p>
  `;

  speechCard.querySelector(".speech-text").textContent =
    "Your document is ready. How can I help you?";

  statusCard.querySelector(".insight-value").textContent =
    "Document uploaded in UI preview mode.";
});

promptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.textContent.trim();
    appendBubble(prompt, "user");
    appendBubble(cannedResponses[prompt] || "This is a sample response for the selected action.", "assistant");
  });
});

chatComposer.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = chatInput.value.trim();

  if (!question) {
    return;
  }

  appendBubble(question, "user");
  appendBubble(
    "This is a UI-only answer preview. Connect your retrieval pipeline later to return live answers from uploaded documents.",
    "assistant"
  );

  chatInput.value = "";
});

deliveryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(deliveryForm);
  const name = formData.get("name") || "The client";

  speechCard.querySelector(".speech-text").textContent =
    `Your message for ${name} has been sent successfully.`;

  statusCard.querySelector(".insight-value").textContent =
    "Delivery form submitted in UI preview mode.";
});
