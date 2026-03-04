import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [plant, setPlant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.id)
      else {
        setEmployee(null)
        setPlant(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchEmployee(authUserId) {
    try {
      const { data } = await supabase
        .from('employees')
        .select('*, plants(*)')
        .eq('auth_user_id', authUserId)
        .single()

      if (data) {
        setEmployee(data)
        setPlant(data.plants)
      }
    } catch (err) {
      console.error('Error fetching employee:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out. Supabase may be blocked by your ISP in India. Try using a VPN.')), 8000)
    )
    const signInPromise = supabase.auth.signInWithPassword({ email, password })
      .then(({ data, error }) => {
        if (error) throw error
        return data
      })
    return Promise.race([signInPromise, timeoutPromise])
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setEmployee(null)
    setPlant(null)
  }

  return (
    <AuthContext.Provider value={{ user, employee, plant, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
