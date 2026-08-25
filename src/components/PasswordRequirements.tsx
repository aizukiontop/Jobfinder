import { passwordRules } from '../lib/passwordPolicy'

export default function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null

  return (
    <ul className="mt-2 space-y-1">
      {passwordRules(password).map(rule => (
        <li key={rule.label} className="flex items-center gap-1.5 text-xs">
          <span style={{ color: rule.met ? '#16a34a' : '#9ca3af' }} aria-hidden="true">
            {rule.met ? '✓' : '○'}
          </span>
          <span style={{ color: rule.met ? '#16a34a' : '#6b7280' }}>{rule.label}</span>
        </li>
      ))}
    </ul>
  )
}
