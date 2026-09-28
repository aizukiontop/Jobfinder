import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { loadTypeScript } from './helpers/load-typescript.mjs'

const source = name => fileURLToPath(new URL('../src/' + name, import.meta.url))
const { ALPHA, BETA, DEFAULT_SKILL_WEIGHT_PERCENT, computeMatchScore, recommendationWeights } = loadTypeScript(source('config/matching.ts'))

test('PREF-01 the default weight is the evaluated 70/30 split', () => {
  assert.equal(DEFAULT_SKILL_WEIGHT_PERCENT, 70)
  assert.deepEqual(recommendationWeights(DEFAULT_SKILL_WEIGHT_PERCENT), { skillWeight: ALPHA, accessibilityWeight: BETA })
})

test('PREF-01 the default score is identical to the original 0.70 S + 0.30 G formula', () => {
  for (const [skill, distance] of [[0, 0], [1, 1], [0.8, 0.9], [0.25, 0.6], [1 / 3, 0.5]]) {
    assert.equal(computeMatchScore(skill, distance), ALPHA * skill + BETA * distance)
  }
})

test('PREF-02 every allowed skill weight has a complementary distance weight totalling 100', () => {
  for (const [percent, distancePercent] of [[0, 100], [50, 50], [70, 30], [100, 0]]) {
    const { skillWeight, accessibilityWeight } = recommendationWeights(percent)
    assert.equal(Math.round(skillWeight * 100), percent)
    assert.equal(Math.round(accessibilityWeight * 100), distancePercent)
    assert.equal(Math.round((skillWeight + accessibilityWeight) * 100), 100)
  }
})

test('PREF-03 fractional, negative, above-100 and non-number weights are refused', () => {
  for (const bad of [1.5, -1, 101, '70', Number.NaN]) {
    assert.throws(() => recommendationWeights(bad), RangeError)
  }
})

test('PREF-07 a 100% skill weight ranks by skill only and a 0% weight by distance only', () => {
  assert.equal(computeMatchScore(0.6, 0.9, 100), 0.6)
  assert.equal(computeMatchScore(0.6, 0.9, 0), 0.9)
})

test('PREF-08 a missing distance counts as zero instead of re-scaling the skill weight', () => {
  assert.equal(computeMatchScore(1, 0, 70), 0.7)
  assert.equal(computeMatchScore(1, 0, 40), 0.4)
})
