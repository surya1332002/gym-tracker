export type ApprovedCatalogueImage = Readonly<{
  catalogueId: string; url: string; attribution: string; license: string; evidenceUrl: string
}>

// Only reviewed, asset-specific permissions belong here. The upstream Unlicense
// does not verify third-party photographs. No current source photos are approved.
const approvedImages: readonly ApprovedCatalogueImage[] = []

export function catalogueImages(catalogueId: string, references: unknown,
  approvals: readonly ApprovedCatalogueImage[] = approvedImages): readonly ApprovedCatalogueImage[] {
  if (!Array.isArray(references)) return []
  const urls = new Set(references.flatMap(ref => ref && typeof ref === 'object' && typeof ref.url === 'string' ? [ref.url] : []))
  return approvals.filter(image => {
    if (image.catalogueId !== catalogueId || !urls.has(image.url) || !image.license || !image.attribution || !image.evidenceUrl) return false
    try {
      const url = new URL(image.url), evidence = new URL(image.evidenceUrl)
      return url.protocol === 'https:' && !url.username && !url.password && evidence.protocol === 'https:'
    } catch { return false }
  })
}
