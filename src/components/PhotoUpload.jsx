import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function PhotoUpload({ label, value, onChange, bucket = 'photos' }) {
  const inputRef = useRef()
  const [preview, setPreview] = useState(value || null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)

    // Upload to Supabase storage
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const filePath = `issues/${fileName}`

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
      const publicUrl = urlData.publicUrl

      setPreview(publicUrl)
      onChange?.(publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      // Still keep the local preview but pass the file for fallback
      onChange?.(localUrl)
    } finally {
      setUploading(false)
    }
  }

  function clear() {
    setPreview(null)
    onChange?.(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5A6B62", marginBottom: 6 }}>{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      {preview ? (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8E4" }}>
          <img src={preview} alt="Upload" style={{ width: '100%', height: 128, objectFit: 'cover' }} />
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Loader2 size={24} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          <button
            onClick={clear}
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28,
              background: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white',
              border: 'none', cursor: 'pointer'
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          style={{ width: "100%", padding: "24px 16px", borderRadius: 12, border: "2px dashed #E2E8E4", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#C5CFC8", cursor: "pointer", background: 'transparent' }}
        >
          <Camera size={28} />
          <span style={{ fontSize: 12 }}>Take photo or upload</span>
        </button>
      )}
    </div>
  )
}
