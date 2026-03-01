import { useRef, useState } from 'react'
import { Camera, X, Image } from 'lucide-react'

export default function PhotoUpload({ label, value, onChange, bucket = 'photos' }) {
  const inputRef = useRef()
  const [preview, setPreview] = useState(value || null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    onChange?.(file)
  }

  function clear() {
    setPreview(null)
    onChange?.(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5A6B62", marginBottom: 6 }}>{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {preview ? (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8E4" }}>
          <img src={preview} alt="Upload" className="w-full h-32 object-cover" />
          <button
            onClick={clear}
            className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          style={{ width: "100%", padding: "24px 16px", borderRadius: 12, border: "2px dashed #E2E8E4", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#C5CFC8", cursor: "pointer", transition: "all 0.3s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1B7A45"; e.currentTarget.style.color = "#1B7A45"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8E4"; e.currentTarget.style.color = "#C5CFC8"; }}
        >
          <Camera size={28} />
          <span className="text-xs">Take photo or upload</span>
        </button>
      )}
    </div>
  )
}
