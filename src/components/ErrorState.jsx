export default function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: 32 }}>
      <p style={{ fontSize: 14, color: '#d32f2f', fontWeight: 600, marginBottom: 12 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: '#2d6a4f',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  )
}
