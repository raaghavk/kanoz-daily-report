import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { FileText, X, Upload, Loader2 } from 'lucide-react'

// Photo or PDF uploader -> returns a public URL via onChange. Bucket: photos.
export default function FilePicker({ value, onChange, folder = 'asset-docs', label = 'Add photo or PDF' }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowed.includes(file.type)) { showToast('Only PDF or image files allowed', 'error'); fileRef.current.value = ''; return }
    if (file.size > 15 * 1024 * 1024) { showToast('File must be under 15MB', 'error'); fileRef.current.value = ''; return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
      onChange(urlData.publicUrl)
      showToast('Uploaded', 'success')
    } catch { showToast('Upload failed', 'error'); if (fileRef.current) fileRef.current.value = '' }
    finally { setUploading(false) }
  }
  function clear() { onChange(null); if (fileRef.current) fileRef.current.value = '' }
  const isPdf = value && value.toLowerCase().includes('.pdf')

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleFile} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#e8f0ec' }}>
          <FileText size={20} style={{ color: '#2d6a4f', flexShrink: 0 }} />
          <a href={value} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2d6a4f', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isPdf ? 'View PDF' : 'View image'}</a>
          <button type="button" onClick={clear} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ width: '100%', padding: '14px 12px', borderRadius: 12, border: '2px dashed #b8d4c4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#2d6a4f', cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(45,106,79,0.03)', fontWeight: 600, fontSize: 13 }}>
          {uploading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</> : <><Upload size={18} /> {label}</>}
        </button>
      )}
    </div>
  )
}
