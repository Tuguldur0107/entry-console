// Console-оос боломж асаах/унтраах — overrides JSON-ийг бусад түлхүүрийг хөндөлгүй засна.
import assert from "node:assert/strict";
import test from "node:test";

import { overrideFeatureState, setOverrideFeature } from "../lib/saas-subscriptions";

test("overrideFeatureState: байхгүй → null, true/false ил", () => {
  assert.equal(overrideFeatureState("", "knowledge"), null);
  assert.equal(overrideFeatureState('{"features":{"knowledge":true}}', "knowledge"), true);
  assert.equal(overrideFeatureState('{"features":{"knowledge":false}}', "knowledge"), false);
  assert.equal(overrideFeatureState('{"limits":{"seats":5}}', "knowledge"), null);
  assert.equal(overrideFeatureState("{буруу", "knowledge"), null);
});

test("setOverrideFeature: хоосноос асаах, бусад түлхүүр хэвээр", () => {
  const on = setOverrideFeature("", "knowledge", true);
  assert.deepEqual(JSON.parse(on), { features: { knowledge: true } });

  const merged = setOverrideFeature('{"features":{"api.rest":true},"limits":{"seats":5}}', "knowledge", true);
  assert.deepEqual(JSON.parse(merged), { features: { "api.rest": true, knowledge: true }, limits: { seats: 5 } });
});

test("setOverrideFeature: null = override хасна; хоосон болбол текст хоосон", () => {
  assert.equal(setOverrideFeature('{"features":{"knowledge":true}}', "knowledge", null), "");
  const kept = setOverrideFeature('{"features":{"knowledge":true,"mcp":false}}', "knowledge", null);
  assert.deepEqual(JSON.parse(kept), { features: { mcp: false } });
});

test("setOverrideFeature: буруу JSON-ийг ХӨНДӨХГҮЙ", () => {
  assert.equal(setOverrideFeature("{буруу", "knowledge", true), "{буруу");
  assert.equal(setOverrideFeature("[1,2]", "knowledge", true), "[1,2]");
});
