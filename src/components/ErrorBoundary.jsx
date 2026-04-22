import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#fefae0', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
            <h2 style={{ fontFamily: 'Inter, sans-serif', color: '#2c2c2c', margin: '0 0 8px', fontSize: 20 }}>Something went wrong</h2>
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#595c4a', margin: '0 0 24px', fontSize: 14, lineHeight: 1.5 }}>
              The app ran into an unexpected error. This usually fixes itself with a refresh.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: '#2d6a4f', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Refresh App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
