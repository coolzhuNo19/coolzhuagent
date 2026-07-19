import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function extractFunction(sourceText, name) {
  const marker = `function ${name}`;
  const start = sourceText.indexOf(marker);
  assert.notEqual(start, -1, `${name} should be defined`);
  const braceStart = sourceText.indexOf("{", start);
  assert.notEqual(braceStart, -1, `${name} should have a function body`);
  let depth = 0;
  for (let index = braceStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return sourceText.slice(start, index + 1);
    }
  }
  assert.fail(`${name} body should be balanced`);
}

const helperSource = extractFunction(source, "sanitizeAssistantMessageTextForTts");
const sanitizeAssistantMessageTextForTts = new Function(
  `${helperSource}; return sanitizeAssistantMessageTextForTts;`,
)();

const replyWithDiagnostics = [
  "库珠是我——一个融合武侠美学与现代工程效率的 AI Agent，专注、沉浸、可持续地陪你把每个想法落地成真。",
  "",
  "---",
  "Remote context usage: 7.0% (69930/1000000 input tokens; source=remote). Local estimate: 56332 tokens; local prompt budget: 56332/848976 tokens; history truncated: false.",
].join("\n");

assert.equal(
  sanitizeAssistantMessageTextForTts(replyWithDiagnostics),
  "库珠是我——一个融合武侠美学与现代工程效率的 AI Agent，专注、沉浸、可持续地陪你把每个想法落地成真。",
);

assert.equal(
  sanitizeAssistantMessageTextForTts("正文\nRemote context usage: 1.0%"),
  "正文",
);

assert.equal(
  sanitizeAssistantMessageTextForTts("  只有正文  "),
  "只有正文",
);

console.log("tts text contracts: PASS");
