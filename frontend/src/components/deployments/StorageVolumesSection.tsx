import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, X, HardDrive, Info } from 'lucide-react'
import type { StorageVolume, VolumePurpose, PersistentVolumeAccessMode } from '@kubeairunway/shared'

const MAX_VOLUMES = 8

const SYSTEM_PATHS = ['/dev', '/proc', '/sys', '/etc', '/var/run']

const PURPOSE_LABELS: Record<VolumePurpose, string> = {
  modelCache: 'Model Cache',
  compilationCache: 'Compilation Cache',
  custom: 'Custom',
}

const DEFAULT_MOUNT_PATHS: Partial<Record<VolumePurpose, string>> = {
  modelCache: '/model-cache',
  compilationCache: '/compilation-cache',
}

interface StorageVolumesSectionProps {
  volumes: StorageVolume[]
  onChange: (volumes: StorageVolume[]) => void
  deploymentName?: string
}

function generateVolumeName(existingVolumes: StorageVolume[]): string {
  const existingNames = new Set(existingVolumes.map(v => v.name))
  for (let i = 1; i <= MAX_VOLUMES + 1; i++) {
    const name = `vol-${i}`
    if (!existingNames.has(name)) return name
  }
  return `vol-${Date.now()}`
}

function isSystemPath(path: string): boolean {
  return SYSTEM_PATHS.some(sp => path === sp || path.startsWith(sp + '/'))
}

function validateVolumeName(name: string, index: number, volumes: StorageVolume[]): string | null {
  if (!name) return 'Volume name is required'
  if (name.length > 63) return 'Must be 63 characters or less'
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) return 'Must be lowercase alphanumeric with hyphens'
  const duplicate = volumes.findIndex((v, i) => i !== index && v.name === name)
  if (duplicate >= 0) return 'Volume name must be unique'
  return null
}

function validateMountPath(mountPath: string | undefined, purpose: VolumePurpose | undefined, index: number, volumes: StorageVolume[]): string | null {
  if (!mountPath) {
    if (purpose === 'custom') return 'Mount path is required for custom volumes'
    return null
  }
  if (!mountPath.startsWith('/')) return 'Must be an absolute path (start with /)'
  if (isSystemPath(mountPath)) return `System path "${mountPath}" is not allowed`
  const duplicate = volumes.findIndex((v, i) => i !== index && v.mountPath === mountPath)
  if (duplicate >= 0) return 'Mount path must be unique across volumes'
  return null
}

export function StorageVolumesSection({ volumes, onChange, deploymentName }: StorageVolumesSectionProps) {
  // Track which volume cards have been interacted with for showing validation
  const [touched, setTouched] = useState<Record<number, Set<string>>>({})

  const markTouched = (index: number, field: string) => {
    setTouched(prev => {
      const fields = new Set(prev[index] || [])
      fields.add(field)
      return { ...prev, [index]: fields }
    })
  }

  const isTouched = (index: number, field: string) => touched[index]?.has(field) ?? false

  const addVolume = () => {
    if (volumes.length >= MAX_VOLUMES) return
    const newVolume: StorageVolume = {
      name: generateVolumeName(volumes),
      purpose: 'custom',
      readOnly: false,
      size: '100Gi',
      accessMode: 'ReadWriteMany',
    }
    onChange([...volumes, newVolume])
  }

  const removeVolume = (index: number) => {
    const updated = volumes.filter((_, i) => i !== index)
    onChange(updated)
    // Clean up touched state
    setTouched(prev => {
      const next = { ...prev }
      delete next[index]
      // Re-index entries above the removed index
      const reindexed: Record<number, Set<string>> = {}
      for (const [key, value] of Object.entries(next)) {
        const k = parseInt(key)
        reindexed[k > index ? k - 1 : k] = value
      }
      return reindexed
    })
  }

  const updateVolume = (index: number, updates: Partial<StorageVolume>) => {
    const updated = volumes.map((v, i) => i === index ? { ...v, ...updates } : v)
    onChange(updated)
  }

  const handlePurposeChange = (index: number, purpose: VolumePurpose) => {
    const updates: Partial<StorageVolume> = { purpose }
    // Pre-fill mount path for cache purposes, but only if empty or matches previous default
    const currentVolume = volumes[index]
    const previousDefault = currentVolume.purpose ? DEFAULT_MOUNT_PATHS[currentVolume.purpose] : undefined
    const newDefault = DEFAULT_MOUNT_PATHS[purpose]
    if (newDefault && (!currentVolume.mountPath || currentVolume.mountPath === previousDefault)) {
      updates.mountPath = newDefault
    }
    updateVolume(index, updates)
  }

  // Check which singleton purposes are already used
  const usedPurposes = new Set(
    volumes
      .map(v => v.purpose)
      .filter((p): p is VolumePurpose => p === 'modelCache' || p === 'compilationCache')
  )

  // Determine source mode per volume for UI toggle
  const getSourceMode = (vol: StorageVolume): 'new' | 'existing' => {
    // If size is set, it's "Create New PVC"
    if (vol.size) return 'new'
    // If claimName is set without size, it's "Use Existing PVC"
    if (vol.claimName) return 'existing'
    // Default to 'new' for new volumes
    return 'new'
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {volumes.map((vol, index) => {
          const nameError = isTouched(index, 'name') ? validateVolumeName(vol.name, index, volumes) : null
          const mountPathError = isTouched(index, 'mountPath') ? validateMountPath(vol.mountPath, vol.purpose, index, volumes) : null
          const sourceMode = getSourceMode(vol)
          const isNewPvc = sourceMode === 'new'

          return (
            <div
              key={index}
              className="relative rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4"
            >
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeVolume(index)}
                className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={`Remove volume ${vol.name}`}
              >
                <X className="h-4 w-4" />
              </button>

              {/* Volume header */}
              <div className="flex items-center gap-2 pr-8">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Volume {index + 1}</span>
                {vol.purpose && vol.purpose !== 'custom' && (
                  <Badge variant="outline" className="text-xs">
                    {PURPOSE_LABELS[vol.purpose]}
                  </Badge>
                )}
              </div>

              {/* Row 1: Name + Purpose */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`vol-name-${index}`}>Name</Label>
                  <Input
                    id={`vol-name-${index}`}
                    value={vol.name}
                    onChange={(e) => {
                      updateVolume(index, { name: e.target.value })
                      markTouched(index, 'name')
                    }}
                    onBlur={() => markTouched(index, 'name')}
                    placeholder="e.g. model-data"
                    className={nameError ? 'border-destructive' : ''}
                  />
                  {nameError && (
                    <p className="text-xs text-destructive">{nameError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`vol-purpose-${index}`}>Purpose</Label>
                  <Select
                    value={vol.purpose || 'custom'}
                    onValueChange={(value) => handlePurposeChange(index, value as VolumePurpose)}
                  >
                    <SelectTrigger id={`vol-purpose-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['modelCache', 'compilationCache', 'custom'] as VolumePurpose[]).map((purpose) => {
                        const isSingleton = purpose === 'modelCache' || purpose === 'compilationCache'
                        const isUsedElsewhere = isSingleton && usedPurposes.has(purpose) && vol.purpose !== purpose
                        return (
                          <SelectItem
                            key={purpose}
                            value={purpose}
                            disabled={isUsedElsewhere}
                          >
                            {PURPOSE_LABELS[purpose]}
                            {isUsedElsewhere && ' (already used)'}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Mount Path */}
              <div className="space-y-1.5">
                <Label htmlFor={`vol-mount-${index}`}>
                  Mount Path
                  {vol.purpose === 'custom' && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={`vol-mount-${index}`}
                  value={vol.mountPath || ''}
                  onChange={(e) => {
                    updateVolume(index, { mountPath: e.target.value || undefined })
                    markTouched(index, 'mountPath')
                  }}
                  onBlur={() => markTouched(index, 'mountPath')}
                  placeholder={
                    vol.purpose === 'modelCache' ? '/model-cache' :
                    vol.purpose === 'compilationCache' ? '/compilation-cache' :
                    '/data/my-volume'
                  }
                  className={mountPathError ? 'border-destructive' : ''}
                />
                {mountPathError && (
                  <p className="text-xs text-destructive">{mountPathError}</p>
                )}
              </div>

              {/* Row 3: Storage Source Toggle */}
              <div className="space-y-3">
                <Label>Storage Source</Label>
                <RadioGroup
                  value={sourceMode}
                  onValueChange={(value) => {
                    if (value === 'new') {
                      // Switching to "Create New PVC" - clear claimName, set a default size
                      updateVolume(index, {
                        size: vol.size || '100Gi',
                        claimName: undefined,
                        readOnly: false,
                        accessMode: vol.accessMode || 'ReadWriteMany',
                      })
                    } else {
                      // Switching to "Use Existing PVC" - clear size/storageClassName/accessMode
                      updateVolume(index, {
                        size: undefined,
                        storageClassName: undefined,
                        accessMode: undefined,
                        claimName: vol.claimName || '',
                      })
                    }
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id={`vol-source-new-${index}`} />
                    <Label htmlFor={`vol-source-new-${index}`} className="font-normal cursor-pointer">
                      Create New PVC
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="existing" id={`vol-source-existing-${index}`} />
                    <Label htmlFor={`vol-source-existing-${index}`} className="font-normal cursor-pointer">
                      Use Existing PVC
                    </Label>
                  </div>
                </RadioGroup>

                {/* New PVC fields */}
                {isNewPvc && (
                  <div className="space-y-3 pl-4 border-l-2 border-white/5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`vol-size-${index}`}>Size</Label>
                        <Input
                          id={`vol-size-${index}`}
                          value={vol.size || ''}
                          onChange={(e) => updateVolume(index, { size: e.target.value || undefined })}
                          placeholder="e.g. 100Gi"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`vol-access-${index}`}>Access Mode</Label>
                        <Select
                          value={vol.accessMode || 'ReadWriteMany'}
                          onValueChange={(value) => updateVolume(index, { accessMode: value as PersistentVolumeAccessMode })}
                        >
                          <SelectTrigger id={`vol-access-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ReadWriteOnce">ReadWriteOnce</SelectItem>
                            <SelectItem value="ReadWriteMany">ReadWriteMany</SelectItem>
                            <SelectItem value="ReadOnlyMany">ReadOnlyMany</SelectItem>
                            <SelectItem value="ReadWriteOncePod">ReadWriteOncePod</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Storage Class - 3-state handling */}
                    <StorageClassField
                      index={index}
                      storageClassName={vol.storageClassName}
                      onChange={(value) => updateVolume(index, { storageClassName: value })}
                    />
                  </div>
                )}

                {/* Existing PVC fields */}
                {!isNewPvc && (
                  <div className="space-y-3 pl-4 border-l-2 border-white/5">
                    <div className="space-y-1.5">
                      <Label htmlFor={`vol-claim-${index}`}>
                        PVC Claim Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`vol-claim-${index}`}
                        value={vol.claimName || ''}
                        onChange={(e) => {
                          updateVolume(index, { claimName: e.target.value || undefined })
                          markTouched(index, 'claimName')
                        }}
                        onBlur={() => markTouched(index, 'claimName')}
                        placeholder="my-existing-pvc"
                        className={isTouched(index, 'claimName') && !vol.claimName ? 'border-destructive' : ''}
                      />
                      {isTouched(index, 'claimName') && !vol.claimName && (
                        <p className="text-xs text-destructive">Claim name is required for existing PVCs</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Row 4: Read Only toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="font-normal">Read Only</Label>
                  {isNewPvc && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Controller-created PVCs require write access</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Switch
                  checked={vol.readOnly || false}
                  onCheckedChange={(checked) => updateVolume(index, { readOnly: checked })}
                  disabled={isNewPvc}
                />
              </div>

              {/* Auto-generated claim name preview */}
              {isNewPvc && deploymentName && vol.name && (
                <p className="text-xs text-muted-foreground">
                  PVC name: <code className="font-mono-code">{deploymentName}-{vol.name}</code>
                </p>
              )}
            </div>
          )
        })}

        {/* Add Volume Button */}
        <Button
          type="button"
          variant="outline"
          onClick={addVolume}
          disabled={volumes.length >= MAX_VOLUMES}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Volume
          {volumes.length > 0 && (
            <span className="ml-2 text-muted-foreground">
              ({volumes.length}/{MAX_VOLUMES})
            </span>
          )}
        </Button>
      </div>
    </TooltipProvider>
  )
}

// Sub-component: 3-state storage class field
function StorageClassField({
  index,
  storageClassName,
  onChange,
}: {
  index: number
  storageClassName: string | undefined
  onChange: (value: string | undefined) => void
}) {
  // 3 states:
  // - undefined → use cluster default (checkbox checked)
  // - '' → explicit empty string (disables dynamic provisioning)
  // - 'some-value' → named class
  const useClusterDefault = storageClassName === undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={`vol-sc-${index}`}>Storage Class</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              <strong>Cluster default</strong>: omits storageClassName (uses cluster&apos;s default StorageClass).{' '}
              <strong>Custom</strong>: specify a class name, or leave empty to disable dynamic provisioning.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={useClusterDefault}
            onChange={(e) => {
              if (e.target.checked) {
                onChange(undefined)
              } else {
                onChange('')
              }
            }}
            className="rounded border-white/20"
          />
          Use cluster default
        </label>
      </div>

      {!useClusterDefault && (
        <Input
          id={`vol-sc-${index}`}
          value={storageClassName || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. premium-ssd (leave empty to disable dynamic provisioning)"
        />
      )}
    </div>
  )
}
