import { useApp } from '../context'

export default function NotificationToggle({ description }: { description: string }) {
  const { preferences, savePreferences, preferencesSaving } = useApp()

  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={preferences.notificationEmails}
        disabled={preferencesSaving}
        onChange={e => savePreferences({ notificationEmails: e.target.checked })}
        style={{ accentColor: '#16a34a', marginTop: 3 }}
      />
      <span>
        <span className="block text-sm font-medium text-gray-800">Email notifications</span>
        <span className="block text-xs text-gray-500">{description} Password reset emails are always sent.</span>
      </span>
    </label>
  )
}
