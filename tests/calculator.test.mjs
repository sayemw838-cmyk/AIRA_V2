// Run with: node tests/calculator.test.mjs
// Loads the calculator section of src/app.js and checks it against known answers.
import fs from "fs";
import assert from "assert/strict";

const src = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const start = src.indexOf("/* ---------- Safe Calculator ---------- */");
const end = src.indexOf("function currentTime(");
const safeCalculate = new Function(src.slice(start, end) + "return safeCalculate;")();

const ok = {
  "2+2": 4, "438 * 1.17": 512.46, "15% * 200": 30, "200 * 15%": 30, "50%": 0.5,
  "10 % 3": 1, "7 % 2 + 1": 2, "2^10": 1024, "2**10": 1024, "2^3^2": 512, "-2^2": -4, "(-2)^2": 4,
  "2^-1": 0.5, "sqrt(16)": 4, "√16": 4, "√(16)": 4, "√2*√2": 2, "sin(pi/2)": 1, "log(e)": 1,
  "log10(1000)": 3, "ln(1)": 0, "min(3,1,2)": 1, "max(3, 1, 2)": 3, "3 × 4": 12, "12 ÷ 4": 3,
  "0.1+0.2": 0.3, "2e3": 2000, "Math.sqrt(9)": 3, "Math.pow(2,8)": 256, "hypot(3,4)": 5,
};
for (const [expr, expected] of Object.entries(ok)) {
  const r = safeCalculate(expr);
  assert.equal(r.success, true, expr + " → " + r.error);
  assert.equal(r.output, expected, expr);
}

const rejected = [
  "", "1+", "(1+2", "1/0", "2(3)", "foo(2)", "x+1", "alert(1)", "constructor", "__proto__",
  '[]["constructor"]["constructor"]("return this")()', "toString(1)", "hasOwnProperty(1)",
];
for (const expr of rejected) {
  assert.equal(safeCalculate(expr).success, false, "should reject: " + expr);
}
console.log("calculator: " + (Object.keys(ok).length + rejected.length) + " checks passed");
