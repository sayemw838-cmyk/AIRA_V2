import assert from "node:assert/strict";
import test from "node:test";
import { BUILD_QUALITY_RULES } from "../src/prompt/build-quality-rules.js";

const policy = BUILD_QUALITY_RULES.toLowerCase();
const categories = [
  {
    name: "responsive websites and interactive UI",
    requirements: [
      /semantic links\/buttons/,
      /responsive layout/,
      /visible focus/,
      /working navigation\/actions/,
    ],
  },
  {
    name: "forms and data-entry tools",
    requirements: [
      /validate client input/,
      /field-level feedback/,
      /preserve entered data after recoverable errors/,
      /client-side validation as a security boundary/,
    ],
  },
  {
    name: "calculators and numeric utilities",
    requirements: [
      /verify formulas, units, rounding/,
      /zero\/division-by-zero/,
      /negative and boundary inputs/,
      /representative expected results with tests/,
    ],
  },
  {
    name: "API integrations and service clients",
    requirements: [
      /documented request\/response contracts/,
      /timeouts/,
      /authentication failures/,
      /rate limits/,
      /malformed responses/,
      /credentials out of client code/,
    ],
  },
  {
    name: "data visualizations",
    requirements: [
      /label axes, units, series, and sources/,
      /missing or empty data/,
      /accessible colors/,
      /never fabricate data/,
    ],
  },
  {
    name: "existing-project changes",
    requirements: [
      /inspect its files, readme\/configuration, relevant implementation, and tests/,
      /follow its architecture, framework, conventions, and dependency choices/,
      /make the smallest complete change and preserve working behavior/,
      /do not force single-file architecture on larger or existing projects/,
    ],
  },
];

for (const { name, requirements } of categories) {
  test(`code-generation regression: ${name}`, () => {
    for (const requirement of requirements) {
      assert.match(policy, requirement, `Missing policy requirement: ${requirement}`);
    }
  });
}

test("cross-domain regression cases remain under the shared prompt policy", () => {
  assert.match(policy, /requirements first/);
  assert.match(policy, /negative constraints as hard rules/);
  assert.match(policy, /add or update focused tests/);
  assert.match(policy, /never claim a check that was not run/);
});
