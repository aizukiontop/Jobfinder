import { AppProvider, useApp } from './context'

import Header from './components/Header'
import EmployerHeader from './components/EmployerHeader'

import Home from './pages/Home'
import Search from './pages/Search'
import SavedJobs from './pages/SavedJobs'
import ApplicationForm from './pages/ApplicationForm'
import Applications from './pages/Applications'
import SignIn from './pages/SignIn'
import Register from './pages/Register'
import Profile from './pages/Profile'
import PostJob from './pages/PostJob'
import JobDetail from './pages/JobDetail'

import EmployerDashboard from './pages/employer/EmployerDashboard'
import EmployerJobs from './pages/employer/EmployerJobs'
import EmployerPostJob from './pages/employer/EmployerPostJob'
import EmployerApplicants from './pages/employer/EmployerApplicants'
import EmployerProfile from './pages/employer/EmployerProfile'

function AppContent() {
  const { page, user, employer } = useApp()

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
      }}
    >
      {isEmployerPage ? (
        <EmployerHeader />
      ) : (
        <Header />
      )}

      <main>
        {renderPage()}
      </main>
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