import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { TextDecoder, TextEncoder } from "node:util";
import assert from "node:assert/strict";

const html = readFileSync("matrix-lite/index.html", "utf8");
const start = html.indexOf("<script>") + "<script>".length;
const end = html.indexOf("</script>", start);
assert.ok(start >= 8 && end > start, "MATRIX LITE inline script must exist");
const ids = [
  "searchChats", "countAll", "countStarred", "countArchived", "history",
  "exportCurrent", "exportAll", "temperature", "responseLength", "theme",
  "accent", "fontSize", "compact", "libraryOverlay", "promptForm",
  "promptList", "savePrompt", "openLibrary", "messages", "form", "send"
];
for (const id of ids) assert.ok(html.includes(`id="${id}"`), `Missing #${id}`);

let fetchCalls = 0;
const tick = String.fromCharCode(96);
const sample = [
  "## Streaming works",
  "",
  "**Bold** with *italic*, `inline code`, and [a link](https://example.com).",
  "",
  "- First item",
  "- Second item",
  "",
  tick.repeat(3) + "js",
  "const answer = 42;",
  tick.repeat(3),
].join("\n");

function mockFetch(_url, _options) {
  fetchCalls++;
  const events = [
    "data: " + JSON.stringify({ choices: [{ delta: { content: sample } }] }) + "\n\n",
    "data: [DONE]\n\n",
  ];
  let index = 0;
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "x-matrix-remaining-today" ? "12" : null },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= events.length) return { done: true };
            return { done: false, value: new TextEncoder().encode(events[index++]) };
          },
        };
      },
    },
  });
}

const dom = new JSDOM(html, {
  url: "https://matrix-lite.test/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = mockFetch;
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
    window.confirm = () => true;
    window.prompt = (_message, value) => (value || "Chat") + " renamed";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    });
  },
});
const { window } = dom;
const $ = (id) => window.document.getElementById(id);
const waitFor = async (fn, label) => {
  for (let i = 0; i < 80; i++) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Timed out waiting for " + label);
};
const submit = () => $("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

try {
  assert.ok($("newChat"), "New Chat button should be present");
  assert.equal(window.document.body.dataset.theme, "dark", "Dark theme should be the default");

  $("prompt").value = "Hello MATRIX";
  submit();
  await waitFor(() => window.document.querySelector(".message.assistant:not(.streaming)"), "first streamed answer");
  assert.equal(fetchCalls, 1, "A chat message should call the chat backend once");
  console.log("Rendered assistant HTML:", window.document.querySelector(".message.assistant .content")?.innerHTML);
  assert.ok(window.document.querySelector(".message.assistant h2"), "Markdown headings should render");
  assert.ok(window.document.querySelector(".message.assistant strong"), "Bold Markdown should render");
  assert.ok(window.document.querySelector(".message.assistant ul li"), "Markdown lists should render");
  assert.ok(window.document.querySelector(".message.assistant .code-block code"), "Fenced code blocks should render");
  assert.ok(window.document.querySelector(".message.assistant a[href='https://example.com']"), "Safe HTTPS Markdown links should render");
  assert.equal($("usage").textContent, "12 shared messages left today", "Usage header should update from the response");

  const edit = window.document.querySelector(".message.user [data-edit]");
  assert.ok(edit, "User message should expose Edit");
  edit.click();
  assert.equal($("prompt").value, "Hello MATRIX", "Edit should restore the original user text to the composer");
  $("prompt").value = "Edited message";
  submit();
  await waitFor(() => fetchCalls === 2 && window.document.querySelector(".message.assistant:not(.streaming)"), "edited message reply");

  const regenerate = window.document.querySelector(".message.assistant [data-regenerate]");
  assert.ok(regenerate, "Last assistant message should expose Regenerate");
  regenerate.click();
  await waitFor(() => fetchCalls === 3 && window.document.querySelector(".message.assistant:not(.streaming)"), "regenerated reply");

  $("searchChats").value = "edited";
  $("searchChats").dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.ok(window.document.querySelector(".chat-row"), "Search should keep matching conversations visible");
  $("searchChats").value = "";
  $("searchChats").dispatchEvent(new window.Event("input", { bubbles: true }));

  window.document.querySelector(".chat-tools button").click();
  window.document.querySelector('[data-view="starred"]').click();
  assert.ok(window.document.querySelector(".chat-row"), "Starred view should show starred chats");
  window.document.querySelector('[data-view="all"]').click();

  const actionMenu = window.document.querySelector(".chat-menu");
  actionMenu.querySelector("summary").click();
  const rename = [...actionMenu.querySelectorAll(".menu-items button")].find((b) => b.textContent === "Rename");
  rename.click();
  assert.match(window.document.querySelector(".chat-title").textContent, /renamed/, "Rename should update the chat title");

  $("settings").click();
  $("theme").value = "light";
  $("theme").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(window.document.body.dataset.theme, "light", "Light theme should apply immediately");
  $("accent").value = "violet";
  $("accent").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(window.document.body.dataset.accent, "violet", "Accent choice should apply");
  $("fontSize").value = "large";
  $("fontSize").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(window.document.body.dataset.font, "large", "Text size preference should apply");
  $("compact").checked = true;
  $("compact").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.ok(window.document.body.classList.contains("compact"), "Compact mode should apply");
  $("temperature").value = "1.1";
  $("temperature").dispatchEvent(new window.Event("input", { bubbles: true }));
  $("responseLength").value = "long";
  $("responseLength").dispatchEvent(new window.Event("change", { bubbles: true }));
  $("close").click();

  $("libraryBtn").click();
  assert.ok(window.document.querySelectorAll(".prompt-card").length >= 4, "Prompt library should show starter prompts");
  $("promptName").value = "Test template";
  $("promptBody").value = "Reusable test prompt";
  $("promptForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.ok(window.document.querySelectorAll(".prompt-card").length >= 5, "Saving a prompt should add it to the library");
  window.document.querySelector(".prompt-card:last-child button.primary").click();
  assert.equal($("prompt").value, "Reusable test prompt", "Use prompt should fill the composer");

  assert.equal(window.localStorage.getItem("matrixLite.prefs") !== null, true, "Preferences should persist locally");
  assert.equal(window.localStorage.getItem("matrixLite.prompts") !== null, true, "Custom prompts should persist locally");
  console.log("MATRIX LITE v1.3.0 browser checks passed.");
} finally {
  window.close();
}
