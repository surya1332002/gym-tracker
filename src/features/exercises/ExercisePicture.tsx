import { useState } from 'react'
import type { ApprovedCatalogueImage } from './catalogueMedia'

export default function ExercisePicture({ image, name }: { image?: ApprovedCatalogueImage; name: string }) {
  const [failedUrl, setFailedUrl] = useState('')
  return <div className="exercise-picture">
    {image && image.url !== failedUrl ? <img src={image.url} alt={`${name} demonstration`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(image.url)} /> : <>
      <svg aria-hidden="true" viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 32h36M14 24v16m10-24v32m48-32v32m10-24v16M14 32h10m48 0h10" />
      </svg><span className="picture-placeholder-label">No photo available</span>
    </>}
  </div>
}
