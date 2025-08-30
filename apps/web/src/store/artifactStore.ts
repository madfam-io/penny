import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { Artifact, ArtifactCollection } from '@penny/types';
import { ArtifactDetector } from '../utils/artifacts/detector';
import { ArtifactTransformer } from '../utils/artifacts/transformer';

export interface User {
  id: string;
  name: string;
  email: string;
  permissions: string[];
}

export interface ArtifactFilter {
  type?: Artifact['type'][];
  tags?: string[];
  createdBy?: string;
  dateRange?: { start: Date; end: Date };
  search?: string;
  isPublic?: boolean;
}

export interface ArtifactState {
  // Data
  artifacts: Artifact[];
  collections: ArtifactCollection[];
  currentUser: User | null;
  
  // UI State
  selectedArtifacts: string[];
  filter: ArtifactFilter;
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'size';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
  showSidebar: boolean;
  
  // Loading states
  loading: boolean;
  creating: boolean;
  error: string | null;
  
  // Actions
  fetchArtifacts: (options?: { force?: boolean }) => Promise<void>;
  fetchArtifact: (id: string) => Promise<void>;
  createArtifact: (data: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<string>;
  updateArtifact: (id: string, updates: Partial<Artifact>) => Promise<boolean>;
  deleteArtifact: (id: string) => Promise<boolean>;
  duplicateArtifact: (id: string) => Promise<string | null>;
  
  // Batch operations
  bulkDelete: (ids: string[]) => Promise<boolean>;
  bulkUpdate: (ids: string[], updates: Partial<Artifact>) => Promise<boolean>;
  bulkExport: (ids: string[], format: string) => Promise<boolean>;
  
  // Sharing
  shareArtifact: (id: string) => Promise<{ shareUrl: string; expiresAt: Date }>;
  
  // Collections
  fetchCollections: () => Promise<void>;
  createCollection: (data: Omit<ArtifactCollection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  addToCollection: (collectionId: string, artifactIds: string[]) => Promise<boolean>;
  removeFromCollection: (collectionId: string, artifactIds: string[]) => Promise<boolean>;
  
  // Annotations
  addAnnotation: (artifactId: string, annotation: any) => void;
  removeAnnotation: (artifactId: string, annotationId: string) => void;
  updateAnnotation: (artifactId: string, annotationId: string, updates: any) => void;
  
  // Filters and sorting
  setFilter: (filter: Partial<ArtifactFilter>) => void;
  clearFilter: () => void;
  setSorting: (sortBy: ArtifactState['sortBy'], sortOrder: ArtifactState['sortOrder']) => void;
  
  // Selection
  selectArtifact: (id: string) => void;
  deselectArtifact: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // UI
  setViewMode: (mode: 'grid' | 'list') => void;
  toggleSidebar: () => void;
  
  // Import/Upload
  importArtifacts: (files: FileList) => Promise<string[]>;
  
  // Cache management
  clearCache: () => void;
  refreshCache: () => Promise<void>;
}

// Mock API functions
const api = {
  async fetchArtifacts(filter?: ArtifactFilter) {
    // Mock API call
    return new Promise<Artifact[]>(resolve => {
      setTimeout(() => {
        const mockArtifacts: Artifact[] = [
          {
            id: '1',
            name: 'Sales Dashboard',
            title: 'Sales Dashboard',
            description: 'Q4 2023 sales performance metrics',
            type: 'chart',
            content: {
              chartType: 'bar',
              data: [{ month: 'Jan', sales: 100 }, { month: 'Feb', sales: 150 }],
              config: { title: 'Monthly Sales', responsive: true }
            },
            conversationId: 'conv1',
            version: 1,
            size: 1024,
            tags: ['sales', 'dashboard'],
            isPublic: false,
            createdAt: new Date('2023-12-01'),
            updatedAt: new Date('2023-12-01'),
            createdBy: 'user1',
            tenantId: 'tenant1',
            exportFormats: ['png', 'svg', 'pdf', 'json']
          },
          {
            id: '2',
            name: 'User Data Table',
            title: 'User Data Table',
            description: 'Active user statistics',
            type: 'table',
            content: {
              columns: [
                { key: 'name', title: 'Name', type: 'string', sortable: true, filterable: true },
                { key: 'email', title: 'Email', type: 'string', sortable: true, filterable: true },
                { key: 'active', title: 'Active', type: 'boolean', sortable: true, filterable: true }
              ],
              data: [
                { name: 'John Doe', email: 'john@example.com', active: true },
                { name: 'Jane Smith', email: 'jane@example.com', active: false }
              ],
              config: {
                pagination: { enabled: true, pageSize: 25, showSizeChanger: true },
                sorting: { enabled: true },
                filtering: { enabled: true, searchable: true },
                selection: { enabled: false, multiple: false },
                export: { enabled: true, formats: ['csv', 'excel'] }
              }
            },
            conversationId: 'conv2',
            version: 1,
            size: 2048,
            tags: ['users', 'data'],
            isPublic: true,
            createdAt: new Date('2023-12-02'),
            updatedAt: new Date('2023-12-02'),
            createdBy: 'user2',
            tenantId: 'tenant1',
            exportFormats: ['csv', 'excel', 'pdf']
          }
        ];
        
        // Apply filters
        let filtered = mockArtifacts;
        
        if (filter?.type?.length) {
          filtered = filtered.filter(a => filter.type!.includes(a.type));
        }
        
        if (filter?.tags?.length) {
          filtered = filtered.filter(a => filter.tags!.some(tag => a.tags.includes(tag)));
        }
        
        if (filter?.search) {
          const search = filter.search.toLowerCase();
          filtered = filtered.filter(a => 
            a.title.toLowerCase().includes(search) ||
            (a.description && a.description.toLowerCase().includes(search))
          );
        }
        
        resolve(filtered);
      }, 500);
    });
  },
  
  async createArtifact(data: any) {
    return new Promise<string>(resolve => {
      setTimeout(() => {
        resolve(Math.random().toString(36).substring(2));
      }, 300);
    });
  },
  
  async updateArtifact(id: string, updates: any) {
    return new Promise<boolean>(resolve => {
      setTimeout(() => resolve(true), 200);
    });
  },
  
  async deleteArtifact(id: string) {
    return new Promise<boolean>(resolve => {
      setTimeout(() => resolve(true), 200);
    });
  },
  
  async shareArtifact(id: string) {
    return new Promise<{ shareUrl: string; expiresAt: Date }>(resolve => {
      setTimeout(() => {
        resolve({
          shareUrl: `/shared/${Math.random().toString(36).substring(2)}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
      }, 200);
    });
  }
};

export const useArtifactStore = create<ArtifactState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      artifacts: [],
      collections: [],
      currentUser: {
        id: 'user1',
        name: 'Demo User',
        email: 'demo@penny.ai',
        permissions: ['create_artifacts', 'edit_artifacts', 'delete_artifacts', 'share_artifacts']
      },
      
      selectedArtifacts: [],
      filter: {},
      sortBy: 'createdAt',
      sortOrder: 'desc',
      viewMode: 'grid',
      showSidebar: true,
      
      loading: false,
      creating: false,
      error: null,
      
      // Actions
      async fetchArtifacts(options) {
        if (get().loading && !options?.force) return;
        
        set({ loading: true, error: null });
        
        try {
          const artifacts = await api.fetchArtifacts(get().filter);
          
          // Apply sorting
          const { sortBy, sortOrder } = get();
          artifacts.sort((a, b) => {
            let aVal: any, bVal: any;
            
            switch (sortBy) {
              case 'title':
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                break;
              case 'size':
                aVal = a.size || 0;
                bVal = b.size || 0;
                break;
              case 'updatedAt':
                aVal = a.updatedAt.getTime();
                bVal = b.updatedAt.getTime();
                break;
              default:
                aVal = a.createdAt.getTime();
                bVal = b.createdAt.getTime();
            }
            
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortOrder === 'asc' ? comparison : -comparison;
          });
          
          set({ artifacts, loading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch artifacts',
            loading: false 
          });
        }
      },
      
      async fetchArtifact(id) {
        const existing = get().artifacts.find(a => a.id === id);
        if (existing) return;
        
        set({ loading: true, error: null });
        
        try {
          // Mock single artifact fetch
          const artifacts = await api.fetchArtifacts();
          const artifact = artifacts.find(a => a.id === id);
          
          if (artifact) {
            set(state => ({
              artifacts: [...state.artifacts.filter(a => a.id !== id), artifact],
              loading: false
            }));
          } else {
            set({ error: 'Artifact not found', loading: false });
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch artifact',
            loading: false 
          });
        }
      },
      
      async createArtifact(data) {
        set({ creating: true, error: null });
        
        try {
          const id = await api.createArtifact(data);
          
          const newArtifact: Artifact = {
            ...data,
            id,
            version: 1,
            size: JSON.stringify(data.content).length,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: get().currentUser?.id || 'anonymous',
            tenantId: 'tenant1',
            exportFormats: []
          };
          
          set(state => ({
            artifacts: [newArtifact, ...state.artifacts],
            creating: false
          }));
          
          return id;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create artifact',
            creating: false 
          });
          throw error;
        }
      },
      
      async updateArtifact(id, updates) {
        set({ error: null });
        
        try {
          const success = await api.updateArtifact(id, updates);
          
          if (success) {
            set(state => ({
              artifacts: state.artifacts.map(artifact => 
                artifact.id === id 
                  ? { 
                      ...artifact, 
                      ...updates, 
                      updatedAt: new Date(),
                      version: (artifact.version || 1) + 1
                    }
                  : artifact
              )
            }));
          }
          
          return success;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to update artifact' });
          return false;
        }
      },
      
      async deleteArtifact(id) {
        set({ error: null });
        
        try {
          const success = await api.deleteArtifact(id);
          
          if (success) {
            set(state => ({
              artifacts: state.artifacts.filter(a => a.id !== id),
              selectedArtifacts: state.selectedArtifacts.filter(sid => sid !== id)
            }));
          }
          
          return success;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete artifact' });
          return false;
        }
      },
      
      async duplicateArtifact(id) {
        const artifact = get().artifacts.find(a => a.id === id);
        if (!artifact) return null;
        
        try {
          const duplicateId = await get().createArtifact({
            ...artifact,
            title: `${artifact.title} (Copy)`,
            isPublic: false
          });
          
          return duplicateId;
        } catch (error) {
          return null;
        }
      },
      
      async bulkDelete(ids) {
        set({ error: null });
        
        try {
          // Mock bulk delete
          const results = await Promise.all(ids.map(id => api.deleteArtifact(id)));
          const success = results.every(r => r);
          
          if (success) {
            set(state => ({
              artifacts: state.artifacts.filter(a => !ids.includes(a.id)),
              selectedArtifacts: state.selectedArtifacts.filter(sid => !ids.includes(sid))
            }));
          }
          
          return success;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Bulk delete failed' });
          return false;
        }
      },
      
      async bulkUpdate(ids, updates) {
        set({ error: null });
        
        try {
          const results = await Promise.all(ids.map(id => api.updateArtifact(id, updates)));
          const success = results.every(r => r);
          
          if (success) {
            set(state => ({
              artifacts: state.artifacts.map(artifact => 
                ids.includes(artifact.id)
                  ? { ...artifact, ...updates, updatedAt: new Date() }
                  : artifact
              )
            }));
          }
          
          return success;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Bulk update failed' });
          return false;
        }
      },
      
      async bulkExport(ids, format) {
        // Mock bulk export
        return true;
      },
      
      async shareArtifact(id) {
        return await api.shareArtifact(id);
      },
      
      async fetchCollections() {
        // Mock collections fetch
        set({ collections: [] });
      },
      
      async createCollection(data) {
        const id = Math.random().toString(36).substring(2);
        const collection: ArtifactCollection = {
          ...data,
          id,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        set(state => ({
          collections: [...state.collections, collection]
        }));
        
        return id;
      },
      
      async addToCollection(collectionId, artifactIds) {
        const state = get();
        const artifactsToAdd = artifactIds.map(id => state.artifacts.find(a => a.id === id)).filter(Boolean) as Artifact[];
        
        set(state => ({
          collections: state.collections.map(collection => 
            collection.id === collectionId
              ? { 
                  ...collection, 
                  artifacts: [...collection.artifacts, ...artifactsToAdd],
                  updatedAt: new Date()
                }
              : collection
          )
        }));
        return true;
      },
      
      async removeFromCollection(collectionId, artifactIds) {
        set(state => ({
          collections: state.collections.map(collection => 
            collection.id === collectionId
              ? { 
                  ...collection, 
                  artifacts: collection.artifacts.filter(artifact => !artifactIds.includes(artifact.id)),
                  updatedAt: new Date()
                }
              : collection
          )
        }));
        return true;
      },
      
      addAnnotation(artifactId, annotation) {
        set(state => ({
          artifacts: state.artifacts.map(artifact => 
            artifact.id === artifactId
              ? {
                  ...artifact,
                  metadata: {
                    ...artifact.metadata,
                    annotations: [
                      ...(artifact.metadata?.annotations || []),
                      annotation
                    ]
                  }
                }
              : artifact
          )
        }));
      },
      
      removeAnnotation(artifactId, annotationId) {
        set(state => ({
          artifacts: state.artifacts.map(artifact => 
            artifact.id === artifactId
              ? {
                  ...artifact,
                  metadata: {
                    ...artifact.metadata,
                    annotations: (artifact.metadata?.annotations || []).filter(
                      (a: any) => a.id !== annotationId
                    )
                  }
                }
              : artifact
          )
        }));
      },
      
      updateAnnotation(artifactId, annotationId, updates) {
        set(state => ({
          artifacts: state.artifacts.map(artifact => 
            artifact.id === artifactId
              ? {
                  ...artifact,
                  metadata: {
                    ...artifact.metadata,
                    annotations: (artifact.metadata?.annotations || []).map(
                      (a: any) => a.id === annotationId ? { ...a, ...updates } : a
                    )
                  }
                }
              : artifact
          )
        }));
      },
      
      setFilter(filter) {
        set(state => ({ filter: { ...state.filter, ...filter } }));
        get().fetchArtifacts({ force: true });
      },
      
      clearFilter() {
        set({ filter: {} });
        get().fetchArtifacts({ force: true });
      },
      
      setSorting(sortBy, sortOrder) {
        set({ sortBy, sortOrder });
        get().fetchArtifacts({ force: true });
      },
      
      selectArtifact(id) {
        set(state => ({
          selectedArtifacts: [...new Set([...state.selectedArtifacts, id])]
        }));
      },
      
      deselectArtifact(id) {
        set(state => ({
          selectedArtifacts: state.selectedArtifacts.filter(sid => sid !== id)
        }));
      },
      
      selectAll() {
        set(state => ({
          selectedArtifacts: state.artifacts.map(a => a.id)
        }));
      },
      
      clearSelection() {
        set({ selectedArtifacts: [] });
      },
      
      setViewMode(mode) {
        set({ viewMode: mode });
      },
      
      toggleSidebar() {
        set(state => ({ showSidebar: !state.showSidebar }));
      },
      
      async importArtifacts(files) {
        const imported: string[] = [];
        
        for (const file of Array.from(files)) {
          try {
            const detection = ArtifactDetector.detectFromFile({
              name: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified
            });
            
            let content: any;
            
            if (file.type.startsWith('image/')) {
              content = {
                src: URL.createObjectURL(file),
                alt: file.name,
                config: { zoomable: true, downloadable: true }
              };
            } else if (file.type === 'application/json') {
              const text = await file.text();
              content = JSON.parse(text);
            } else {
              const text = await file.text();
              
              if (detection.type === 'table' && text.includes(',')) {
                const result = ArtifactTransformer.toTable(text);
                content = result.success ? result.data : { raw: text };
              } else {
                content = { code: text, language: 'text' };
              }
            }
            
            const id = await get().createArtifact({
              name: file.name,
              title: detection.suggestedTitle || file.name,
              type: detection.type,
              content,
              metadata: detection.metadata,
              tags: [],
              isPublic: false
            });
            
            imported.push(id);
          } catch (error) {
            console.error(`Failed to import ${file.name}:`, error);
          }
        }
        
        return imported;
      },
      
      clearCache() {
        set({ artifacts: [], collections: [] });
      },
      
      async refreshCache() {
        await get().fetchArtifacts({ force: true });
        await get().fetchCollections();
      }
    })),
    { name: 'artifact-store' }
  )
);

// Selectors
export const useArtifactSelectors = () => {
  const store = useArtifactStore();
  
  return {
    getArtifactById: (id: string) => store.artifacts.find(a => a.id === id),
    getFilteredArtifacts: () => {
      const { artifacts, filter } = store;
      // Additional filtering logic if needed
      return artifacts;
    },
    getSelectedArtifacts: () => {
      const { artifacts, selectedArtifacts } = store;
      return artifacts.filter(a => selectedArtifacts.includes(a.id));
    },
    getArtifactsByType: (type: Artifact['type']) => {
      return store.artifacts.filter(a => a.type === type);
    },
    getRecentArtifacts: (limit = 10) => {
      return store.artifacts
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, limit);
    }
  };
};

// Subscribe to changes
export const subscribeToArtifacts = (callback: (artifacts: Artifact[]) => void) => {
  return useArtifactStore.subscribe(
    state => state.artifacts,
    callback,
    { equalityFn: (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id) }
  );
};