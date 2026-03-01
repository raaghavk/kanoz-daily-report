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
      {label && <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-kanoz-border">
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
          className="w-full py-6 rounded-xl border-2 border-dashed border-kanoz-border flex flex-col items-center gap-1.5 text-kanoz-text-tertiary hover:border-kanoz-green hover:text-kanoz-green transition-colors"
        >
          <Camera size={28} />
          <span className="text-xs">Take photo or upload</span>
        </button>
      )}
    </div>
  )
}
