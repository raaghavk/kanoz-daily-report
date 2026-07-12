import { useRef, useState, useEffect } from 'react'
import { Camera, Image, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { showToast } from './Toast'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_WIDTH = 1200 // Max image width after compression
const JPEG_QUALITY = 0.75 // 75% quality — good balance of size vs clarity
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// Compress image using Canvas API — reduces 4MB photos to ~200-400KB
function compressImage(file) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width)
        width = MAX_WIDTH
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        resolve(blob || file) // fallback to original if compression fails
      }, 'image/jpeg', JPEG_QUALITY)
    }
    img.onerror = () => resolve(file) // fallback to original
    img.src = URL.createObjectURL(file)
  })
}

// Check if value is an old AppSheet-style path (not a real URL)
function isLegacyPath(val) {
  return val && typeof val === 'string' && !val.startsWith('http') && !val.startsWith('blob:')
}

export default function PhotoUpload({ label, value, onChange, bucket = 'photos', folder = 'issues' }) {
  const cameraRef = useRef()
  const galleryRef = useRef()
  const legacy = isLegacyPath(value)
  const [preview, setPreview] = useState(legacy ? null : (value || null))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)

  // Sync preview when value prop changes (e.g. when edit form loads existing data)
  useEffect(() => {
    if (!isLegacyPath(value)) {
      setPreview(value || null)
      if (value) {
        setUploadError(false)
        setPendingFile(null)
      }
    }
  }, [value])

  async function uploadFile(fileToUpload) {
    setUploading(true)
    setUploadError(false)
    try {
      const compressed = await compressImage(fileToUpload)
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const filePath = `${folder}/${fileName}`

      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, compressed, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
      const publicUrl = urlData.publicUrl

      setPreview(publicUrl)
      onChange?.(publicUrl)
      setPendingFile(null)
    } catch (err) {
      console.error('Upload error:', err)
      showToast('Photo upload failed. Please try again.', 'error')
      setUploadError(true)
      onChange?.(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Only JPEG, PNG, or WebP images allowed', 'error')
      resetInputs()
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Photo must be under 10MB', 'error')
      resetInputs()
      return
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setPendingFile(file)
    await uploadFile(file)
  }

  function resetInputs() {
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  function clear() {
    setPreview(null)
    setPendingFile(null)
    setUploadError(false)
    onChange?.(null)
    resetInputs()
  }

  return (
    <div>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#595c4a", marginBottom: 6 }}>{label}</label>}
      {/* Hidden file inputs — one for camera, one for gallery */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" style={{ display: 'none' }} onChange={handleFile} />
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
            onClick={() => cameraRef.current?.click()}
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 5
            }}>
              <Loader2 size={24} color="white" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {uploadError && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8,
              zIndex: 5
            }}>
              <span style={{ color: '#fca5a5', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={14} /> Upload Failed
              </span>
              <button
                type="button"
                onClick={() => pendingFile && uploadFile(pendingFile)}
                style={{
                  padding: '6px 12px', background: '#2d6a4f', color: 'white', border: 'none',
                  borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <RefreshCw size={12} /> Retry
              </button>
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
              border: 'none', cursor: 'pointer',
              zIndex: 10
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => cameraRef.current?.click()}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 12,
              border: '2px dashed #b8d4c4', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, color: '#2d6a4f', cursor: 'pointer',
              background: 'rgba(45, 106, 79, 0.04)', fontWeight: 600
            }}
          >
            <Camera size={24} />
            <span style={{ fontSize: 11 }}>Take Photo</span>
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 12,
              border: '2px dashed #e5ddd0', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, color: '#8a8d7a', cursor: 'pointer',
              background: 'transparent', fontWeight: 600
            }}
          >
            <Image size={24} />
            <span style={{ fontSize: 11 }}>Gallery</span>
          </button>
        </div>
      )}
    </div>
  )
}
