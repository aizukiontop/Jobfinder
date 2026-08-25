/**
 * Shared footer component.
 * Rendered once in App.tsx so every page gets it automatically.
 * Visual design matches the footer already present in Home.tsx and SavedJobs.tsx.
 */
export default function Footer() {
  return (
    <footer
      style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}
      className="py-6 px-4"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <p className="text-xs text-gray-400">© 2026 JobFinder. All rights reserved.</p>
        <p className="text-xs text-gray-400">Job opportunities in Angeles City, Pampanga.</p>
      </div>
    </footer>
  )
}
