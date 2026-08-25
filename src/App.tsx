import { AppProvider, useApp } from './context'

import Header from './components/Header'
import Home from './pages/Home'
import JobDetail from './pages/JobDetail'
import Search from './pages/Search'

function AppContent() {
  const { page, jobsLoading, jobsError, reloadJobs } = useApp()

  const renderPage = () => {
    switch (page) {
      case 'search':
        return <Search />
      case 'jobdetail':
        return <JobDetail />
      case 'home':
      default:
        return <Home />
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>
      <Header />

      {jobsLoading && (
        <div
          role="status"
          className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-center text-sm text-blue-900"
        >
          Loading verified job listings…
        </div>
      )}

      {jobsError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900"
        >
          <span>{jobsError}</span>
          <button
            type="button"
            onClick={() => void reloadJobs()}
            className="rounded border border-red-300 bg-white px-3 py-1 font-semibold hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      <main>{renderPage()}</main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
