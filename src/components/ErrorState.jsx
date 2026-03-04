export default function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: 32 }}>
      <p style={{ fontSize: 14, color: '#E53E3E', fontWeight: 600, marginBottom: 12 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: '#1B7A45',
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
