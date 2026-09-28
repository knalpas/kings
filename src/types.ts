export type Kingdom = 'france' | 'england'

export type Person = {
  id: string
  /** Display name (regnal where applicable). */
  name: string
  /** Short label on the tree node. */
  shortName: string
  title: string
  dynasty: string
  /** Blood parent in this dataset (another person id), if known. */
  parentId: string | null
  reignStart?: number
  reignEnd?: number
  birth?: number
  death?: number
  epithet?: string
  /** False for non-reigning links needed to connect the tree. */
  reigning?: boolean
  summary: string
  notable?: string[]
  wikipedia?: string
}

export type DynastyStyle = {
  id: string
  label: string
  color: string
  ink?: string
}
