import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { showToast } from './Toast'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// Check if value is an old AppSheet-style path (not a real URL)
function isLegacyPath(val) {
  return val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('blob:')
}

export default function PhotoUpload({ label, value, onChange, bucket = 'photos', folder = 'issues' }) {
  const inputRef = useRef()
  const legacy = isLegacyPath(value)
  const [preview, setPreview] = useState(legacy ? null : (value || null))
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Only JPEG, PNG, or WebP images allowed', 'error')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Photo must be under 10MB', 'error')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)

    // Upload to Supabase storage
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const filePath = `${folder}/${fileName}`

      const { error } = await supabase.storage
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
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#595c4a", marginBottom: 6 }}>{label}</label>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      {legacy ? (
        <div style={{ borderRadius: 12, border: '1.5px solid #e5ddd0', padding: 16, background: '#f5f0e1', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Camera size={20} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c' }}>Original Photo on File</div>
            <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value.replace('Purchase Data_Images/', '')}
            </div>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            style={{ padding: '6px 10px', borderRadius: 8, background: '#2d6a4f', color: 'white', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Replace
          </button>
        </div>
      ) : preview ? (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #e5ddd0" }}>
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
          style={{ width: "100%", padding: "24px 16px", borderRadius: 12, border: "2px dashed #e5ddd0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#b5b8a8", cursor: "pointer", background: 'transparent' }}
        >
          <Camera size={28} />
          <span style={{ fontSize: 12 }}>Take photo or upload</span>
        </button>
      )}
    </div>
  )
}
