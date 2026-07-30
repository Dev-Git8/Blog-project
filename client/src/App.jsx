import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/useAuth.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx'
import { Shell } from './components/layout/Shell.jsx'
import { SiteHeader } from './components/layout/SiteHeader.jsx'
import { SiteFooter } from './components/layout/SiteFooter.jsx'
import { RequireAuth } from './components/RequireAuth.jsx'
import { Landing } from './pages/Landing.jsx'
import { Feed } from './pages/Feed.jsx'
import { Post } from './pages/Post.jsx'
import { Tag } from './pages/Tag.jsx'
import { AuthorProfile } from './pages/AuthorProfile.jsx'
import { SignIn } from './pages/SignIn.jsx'
import { SignUp } from './pages/SignUp.jsx'
import { PostList } from './pages/dashboard/PostList.jsx'
import { Editor } from './pages/dashboard/Editor.jsx'
import { ProfileSettings } from './pages/dashboard/ProfileSettings.jsx'
import { AdminPanel } from './pages/admin/AdminPanel.jsx'
import { NotFound } from './pages/NotFound.jsx'

function Header() {
  const { user, signOut } = useAuth()
  return <SiteHeader user={user} onSignOut={signOut} />
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Shell header={<Header />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/blog" element={<Feed />} />
                <Route path="/blog/:slug" element={<Post />} />
                <Route path="/tag/:tag" element={<Tag />} />
                {/* React Router treats the @ as a literal character. */}
                <Route path="/@:username" element={<AuthorProfile />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />

                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <PostList />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/new"
                  element={
                    <RequireAuth>
                      <Editor />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/posts/:id"
                  element={
                    <RequireAuth>
                      <Editor />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/settings"
                  element={
                    <RequireAuth>
                      <ProfileSettings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth adminOnly>
                      <AdminPanel />
                    </RequireAuth>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
              <SiteFooter />
            </Shell>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
