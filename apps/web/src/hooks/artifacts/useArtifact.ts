import { useState, useEffect, useCallback } from 'react';\nimport { Artifact } from '@penny/types';\nimport { useArtifactStore } from '../../store/artifactStore';\nimport { ArtifactExporter, ExportOptions, ExportResult } from '../../utils/artifacts/exporter';\nimport { ArtifactTransformer, TransformOptions } from '../../utils/artifacts/transformer';

export interface UseArtifactOptions {
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  enableVersioning?: boolean;
}

export interface UseArtifactResult {
  artifact: Artifact | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  exporting: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  save: (updates: Partial<Artifact>) => Promise<boolean>;
  delete: () => Promise<boolean>;
  export: (options: ExportOptions) => Promise<ExportResult>;
  share: () => Promise<{ shareUrl: string; expiresAt: Date } | null>;
  transform: (toType: Artifact['type'], options?: TransformOptions) => Promise<boolean>;
  annotate: (annotation: any) => void;
  
  // Version control
  versions: any[];
  currentVersion: number;
  createVersion: (description?: string) => Promise<boolean>;
  restoreVersion: (version: number) => Promise<boolean>;
  compareVersions: (v1: number, v2: number) => Promise<any>;
  
  // Metadata
  isOwner: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export function useArtifact(artifactId: string, options: UseArtifactOptions = {}): UseArtifactResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  
  const {
    artifacts,
    currentUser,
    fetchArtifact,
    updateArtifact,
    deleteArtifact,
    shareArtifact,
    addAnnotation
  } = useArtifactStore();
  
  const artifact = artifacts.find(a => a.id === artifactId) || null;
  
  // Permissions
  const isOwner = artifact?.createdBy === currentUser?.id;
  const canEdit = isOwner || currentUser?.permissions?.includes('edit_artifacts');
  const canDelete = isOwner || currentUser?.permissions?.includes('delete_artifacts');
  const canShare = artifact?.isPublic || isOwner || currentUser?.permissions?.includes('share_artifacts');
  
  // Load artifact
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await fetchArtifact(artifactId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifact');
    } finally {
      setLoading(false);
    }
  }, [artifactId, fetchArtifact]);
  
  // Save artifact
  const save = useCallback(async (updates: Partial<Artifact>): Promise<boolean> => {
    if (!artifact || !canEdit) return false;
    
    try {
      setSaving(true);
      setError(null);
      
      const success = await updateArtifact(artifact.id, updates);
      
      // Create version if versioning is enabled
      if (success && options.enableVersioning) {
        await createVersion('Auto-save update');
      }
      
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save artifact');
      return false;
    } finally {
      setSaving(false);
    }
  }, [artifact, canEdit, updateArtifact, options.enableVersioning]);
  
  // Delete artifact
  const deleteArtifactHandler = useCallback(async (): Promise<boolean> => {
    if (!artifact || !canDelete) return false;
    
    try {
      setError(null);
      return await deleteArtifact(artifact.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete artifact');
      return false;
    }
  }, [artifact, canDelete, deleteArtifact]);
  
  // Export artifact
  const exportArtifact = useCallback(async (options: ExportOptions): Promise<ExportResult> => {
    if (!artifact) {
      return { success: false, error: 'No artifact to export' };
    }
    
    try {
      setExporting(true);
      setError(null);
      return await ArtifactExporter.export(artifact, options);
    } catch (err) {
      const result = { success: false, error: err instanceof Error ? err.message : 'Export failed' };
      setError(result.error!);
      return result;
    } finally {
      setExporting(false);
    }
  }, [artifact]);
  
  // Share artifact
  const share = useCallback(async (): Promise<{ shareUrl: string; expiresAt: Date } | null> => {
    if (!artifact || !canShare) return null;
    
    try {
      setError(null);
      return await shareArtifact(artifact.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share artifact');
      return null;
    }
  }, [artifact, canShare, shareArtifact]);
  
  // Transform artifact
  const transform = useCallback(async (
    toType: Artifact['type'], 
    transformOptions?: TransformOptions
  ): Promise<boolean> => {
    if (!artifact || !canEdit) return false;
    
    try {
      setError(null);
      
      const result = ArtifactTransformer.transform(
        artifact.content,
        artifact.type,
        toType,
        transformOptions || {}
      );
      
      if (!result.success) {
        setError(result.error!);
        return false;
      }
      
      return await save({
        type: toType,
        content: result.data,
        title: `${artifact.title} (Converted to ${toType})`
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transformation failed');
      return false;
    }
  }, [artifact, canEdit, save]);
  
  // Add annotation
  const annotate = useCallback((annotation: any) => {
    if (!artifact || !canEdit) return;
    
    addAnnotation(artifact.id, {
      id: Math.random().toString(36).substring(2),
      ...annotation,
      createdAt: new Date(),
      createdBy: currentUser?.id || 'anonymous'
    });
  }, [artifact, canEdit, addAnnotation, currentUser]);
  
  // Version control
  const createVersion = useCallback(async (description?: string): Promise<boolean> => {
    if (!artifact || !options.enableVersioning) return false;
    
    try {
      // Mock version creation - would call API
      const version = {
        id: Math.random().toString(36).substring(2),
        artifactId: artifact.id,
        version: (artifact.version || 0) + 1,
        title: artifact.title,
        description: description || 'Version checkpoint',
        content: artifact.content,
        createdAt: new Date(),
        createdBy: currentUser?.id || 'anonymous',
        status: 'published' as const
      };
      
      setVersions(prev => [version, ...prev]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version');
      return false;
    }
  }, [artifact, currentUser, options.enableVersioning]);
  
  const restoreVersion = useCallback(async (version: number): Promise<boolean> => {
    if (!artifact || !canEdit) return false;
    
    try {
      // Mock version restoration - would call API
      const versionData = versions.find(v => v.version === version);
      if (!versionData) {
        setError('Version not found');
        return false;
      }
      
      return await save({
        content: versionData.content,
        version: (artifact.version || 0) + 1
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version');
      return false;
    }
  }, [artifact, canEdit, save, versions]);
  
  const compareVersions = useCallback(async (v1: number, v2: number): Promise<any> => {
    if (!artifact) return null;
    
    try {
      // Mock version comparison - would call API
      const version1 = versions.find(v => v.version === v1);
      const version2 = versions.find(v => v.version === v2);
      
      if (!version1 || !version2) {
        setError('One or more versions not found');
        return null;
      }
      
      // Simple comparison
      return {
        fromVersion: v1,
        toVersion: v2,
        differences: [],
        summary: { added: 0, modified: 0, removed: 0, similarity: 0.95 }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Version comparison failed');
      return null;
    }
  }, [artifact, versions]);
  
  // Auto-save
  useEffect(() => {
    if (!options.enableAutoSave || !artifact || !canEdit) return;
    
    const interval = setInterval(() => {
      // Auto-save logic would go here
      // For now, just a placeholder
    }, options.autoSaveInterval || 30000);
    
    return () => clearInterval(interval);
  }, [artifact, canEdit, options.enableAutoSave, options.autoSaveInterval]);
  
  // Load versions
  useEffect(() => {
    if (!artifact || !options.enableVersioning) return;
    
    // Mock version loading - would call API
    const loadVersions = async () => {
      try {
        // Mock versions data
        const mockVersions = Array.from({ length: 5 }, (_, i) => ({
          id: Math.random().toString(36).substring(2),
          artifactId: artifact.id,
          version: i + 1,
          title: artifact.title,\n          description: `Version ${i + 1}`,
          createdAt: new Date(Date.now() - i * 86400000), // Days ago
          createdBy: currentUser?.id || 'anonymous',
          status: 'published' as const
        }));
        
        setVersions(mockVersions);
      } catch (err) {
        console.error('Failed to load versions:', err);
      }
    };
    
    loadVersions();
  }, [artifact, currentUser, options.enableVersioning]);
  
  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return {
    artifact,
    loading,
    error,
    saving,
    exporting,
    
    // Actions
    refresh,
    save,
    delete: deleteArtifactHandler,
    export: exportArtifact,
    share,
    transform,
    annotate,
    
    // Version control
    versions,
    currentVersion: artifact?.version || 1,
    createVersion,
    restoreVersion,
    compareVersions,
    
    // Permissions
    isOwner,
    canEdit,
    canDelete,
    canShare
  };
}"