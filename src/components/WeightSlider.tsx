import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { DEFAULT_SKILL_WEIGHT_PERCENT } from '../config/matching'

export default function WeightSlider() {
  const { preferences, savePreferences, preferencesSaving, preferencesError } = useApp()
  const savedValue = preferences.skillWeightPercent
  const [value, setValue] = useState(savedValue)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => { setValue(savedValue) }, [savedValue])

  const save = async (next: number) => {
    setValue(next)
    setJustSaved(false)
    if (await savePreferences({ skillWeightPercent: next })) setJustSaved(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="skill-weight" className="text-sm font-semibold text-gray-800">
          How should jobs be ranked?
        </label>
        <span className="text-sm text-gray-700">
          Skill match <strong>{value}%</strong> · Distance <strong>{100 - value}%</strong>
        </span>
      </div>

      <input
        id="skill-weight"
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={e => { setValue(Number(e.target.value)); setJustSaved(false) }}
        aria-valuetext={`Skill match ${value} percent, distance ${100 - value} percent`}
        style={{ accentColor: '#16a34a' }}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>Distance only</span>
        <span>Skills only</span>
      </div>

      {value === 100 && <p className="text-xs text-gray-600">Distance will not affect your ranking.</p>}
      {value === 0 && <p className="text-xs text-gray-600">Skills will not affect your ranking, only road distance.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(value)}
          disabled={preferencesSaving || value === savedValue}
          style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
          className="px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {preferencesSaving ? 'Saving…' : 'Save weights'}
        </button>
        <button
          type="button"
          onClick={() => save(DEFAULT_SKILL_WEIGHT_PERCENT)}
          disabled={preferencesSaving || (value === DEFAULT_SKILL_WEIGHT_PERCENT && savedValue === DEFAULT_SKILL_WEIGHT_PERCENT)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
          className="px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          Reset to {DEFAULT_SKILL_WEIGHT_PERCENT}/{100 - DEFAULT_SKILL_WEIGHT_PERCENT}
        </button>
        {value !== savedValue && !preferencesSaving && (
          <span className="text-xs text-amber-700">Not saved yet. Rankings still use {savedValue}/{100 - savedValue}.</span>
        )}
        {justSaved && value === savedValue && (
          <span role="status" className="text-xs text-green-700">Saved. Rankings now use {savedValue}/{100 - savedValue}.</span>
        )}
      </div>

      {preferencesError && <p role="alert" className="text-xs text-red-700">{preferencesError}</p>}
    </div>
  )
}
