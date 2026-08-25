import { AppProvider, useApp } from './context'

import Header from './components/Header'
import EmployerHeader from './components/EmployerHeader'
import Footer from './components/Footer'

import Home from './pages/Home'
import Search from './pages/Search'
import SavedJobs from './pages/SavedJobs'
import ApplicationForm from './pages/ApplicationForm'
import Applications from './pages/Applications'
import SignIn from './pages/SignIn'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import PostJob from './pages/PostJob'
import JobDetail from './pages/JobDetail'

import EmployerDashboard from './pages/employer/EmployerDashboard'
import EmployerJobs from './pages/employer/EmployerJobs'
import EmployerPostJob from './pages/employer/EmployerPostJob'
import EmployerApplicants from './pages/employer/EmployerApplicants'
import EmployerProfile from './pages/employer/EmployerProfile'

function AppContent() {
  const { page, jobsLoading, jobsError, reloadJobs, actionError, dismissActionError } = useApp()

  const isEmployerPage =
    page === 'employer-dashboard' ||
    page === 'employer-jobs' ||
    page === 'employer-post' ||
    page === 'employer-applicants' ||
    page === 'employer-profile'

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <Home />

      case 'search':
        return <Search />

      case 'saved':
        return <SavedJobs />

      case 'applications':
        return <Applications />

      case 'signin':
        return <SignIn />

      case 'register':
        return <Register />

      case 'forgot':
        return <ForgotPassword />

      case 'reset':
        return <ResetPassword />

      case 'profile':
        return <Profile />

      case 'postjob':
        return <PostJob />

      case 'jobdetail':
        return <JobDetail />

      case 'apply':
        return <ApplicationForm />

      case 'employer-dashboard':
        return <EmployerDashboard />

      case 'employer-jobs':
        return <EmployerJobs />

      case 'employer-post':
        return <EmployerPostJob />

      case 'employer-applicants':
        return <EmployerApplicants />

      case 'employer-profile':
        return <EmployerProfile />

      default:
        return <Home />
    }
  }

  return (
    <div
      style={{
        fontFamily: 'Inter, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {isEmployerPage ? (
        <EmployerHeader />
      ) : (
        <Header />
      )}

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

      {actionError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={dismissActionError}
            className="rounded border border-red-300 bg-white px-3 py-1 font-semibold hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {renderPage()}
      </main>

      <Footer />
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
