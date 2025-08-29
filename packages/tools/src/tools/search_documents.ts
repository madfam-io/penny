import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

// Parameter schema
const SearchDocumentsParamsSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  sources: z.array(z.enum(['documents', 'knowledge_base', 'web', 'emails', 'chats'])).default(['documents']),
  filters: z.object({
    fileTypes: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime()
    }).optional(),
    authors: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    size: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional(),
    language: z.string().optional()
  }).optional(),
  searchType: z.enum(['semantic', 'keyword', 'hybrid']).default('hybrid'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  includeSnippets: z.boolean().default(true),
  highlightMatches: z.boolean().default(true),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  sortBy: z.enum(['relevance', 'date', 'title', 'author', 'size']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

type SearchDocumentsParams = z.infer<typeof SearchDocumentsParamsSchema>;

/**
 * Search Documents Tool Handler
 */
async function searchDocumentsHandler(
  params: SearchDocumentsParams,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const {
      query,
      sources,
      filters,
      searchType,
      limit,
      offset,
      includeSnippets,
      highlightMatches,
      similarityThreshold,
      sortBy,
      sortOrder
    } = params;

    // Perform search across specified sources
    const searchResults = await performSearch({
      query,
      sources,
      filters,
      searchType,
      limit,
      offset,
      similarityThreshold,
      sortBy,
      sortOrder,
      tenantId: context.tenantId,
      userId: context.userId
    });

    // Process results
    const processedResults = await processSearchResults(
      searchResults,
      query,
      includeSnippets,
      highlightMatches
    );

    // Generate search insights
    const insights = generateSearchInsights(processedResults, query);

    // Create artifacts
    const artifacts: any[] = [];

    // Add results summary artifact
    artifacts.push({
      type: 'data',
      name: 'Search Results Summary',
      content: {
        totalResults: processedResults.totalResults,
        sources: processedResults.sources,
        insights,
        query,
        searchType
      },
      mimeType: 'application/json',
      preview: `${processedResults.totalResults} results found for "${query}"`
    });

    // Add detailed results artifact
    artifacts.push({
      type: 'data',
      name: 'Detailed Search Results',
      content: processedResults.results,
      mimeType: 'application/json',
      downloadable: true
    });

    // Add visualization artifact if we have enough results
    if (processedResults.results.length > 5) {
      const visualizationData = createSearchVisualization(processedResults);
      artifacts.push({
        type: 'visualization',
        name: 'Search Results Visualization',
        content: visualizationData,
        mimeType: 'application/json',
        preview: 'Visual breakdown of search results by source and relevance'
      });
    }

    // Calculate usage
    const usage = {
      credits: Math.ceil(processedResults.results.length / 5) + sources.length * 2,
      apiCalls: sources.length,
      duration: Date.now() - (context.executionId ? parseInt(context.executionId.split('_')[1]) : Date.now()),
    };

    return {
      success: true,
      data: {
        results: processedResults.results,
        totalResults: processedResults.totalResults,
        hasMore: processedResults.hasMore,
        query,
        sources,
        insights,
        searchType,
        filters: filters || {}
      },
      artifacts,
      usage,
      metadata: {
        searchType,
        sourcesSearched: sources.length,
        resultsReturned: processedResults.results.length,
        totalMatches: processedResults.totalResults,
        queryTerms: query.split(' ').length,
        cached: false
      }
    };

  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: `Document search failed: ${error.message}`,
        details: error,
        category: 'internal',
        retryable: true
      }
    };
  }
}

/**
 * Perform search across specified sources
 */
async function performSearch(options: {
  query: string;
  sources: string[];
  filters?: any;
  searchType: string;
  limit: number;
  offset: number;
  similarityThreshold: number;
  sortBy: string;
  sortOrder: string;
  tenantId: string;
  userId: string;
}): Promise<any> {
  // In real implementation, this would connect to vector databases, search engines, etc.
  // For now, return mock search results
  
  const mockDocuments = [
    {
      id: 'doc_001',
      title: 'Q3 Financial Report',
      content: 'Our third quarter financial results show strong growth across all segments...',
      source: 'documents',
      author: 'John Smith',
      createdAt: '2024-07-15T10:30:00Z',
      fileType: 'pdf',
      size: 2547892,
      url: '/documents/q3-financial-report.pdf',
      tags: ['finance', 'quarterly', 'report']
    },
    {
      id: 'doc_002',
      title: 'Product Roadmap 2024',
      content: 'This document outlines our product development strategy for 2024...',
      source: 'documents',
      author: 'Sarah Johnson',
      createdAt: '2024-06-20T14:15:00Z',
      fileType: 'docx',
      size: 1234567,
      url: '/documents/product-roadmap-2024.docx',
      tags: ['product', 'roadmap', 'strategy']
    },
    {
      id: 'kb_001',
      title: 'API Documentation',
      content: 'Complete guide to using our REST API endpoints...',
      source: 'knowledge_base',
      author: 'Tech Team',
      createdAt: '2024-08-01T09:00:00Z',
      fileType: 'html',
      size: 567890,
      url: '/kb/api-documentation',
      tags: ['api', 'documentation', 'development']
    },
    {
      id: 'email_001',
      title: 'Re: Meeting Notes - Product Review',
      content: 'Following up on our discussion about the new product features...',
      source: 'emails',
      author: 'Mike Davis',
      createdAt: '2024-08-15T16:45:00Z',
      fileType: 'email',
      size: 12345,
      tags: ['meeting', 'product', 'review']
    },
    {
      id: 'chat_001',
      title: 'Team Discussion - Marketing Campaign',
      content: 'We need to finalize the marketing strategy for the upcoming campaign...',
      source: 'chats',
      author: 'Marketing Team',
      createdAt: '2024-08-20T11:30:00Z',
      fileType: 'chat',
      size: 8901,
      tags: ['marketing', 'campaign', 'strategy']
    }
  ];

  // Filter by sources
  let filteredDocs = mockDocuments.filter(doc => options.sources.includes(doc.source));

  // Apply filters
  if (options.filters) {
    if (options.filters.fileTypes) {
      filteredDocs = filteredDocs.filter(doc => 
        options.filters.fileTypes.includes(doc.fileType)
      );
    }
    
    if (options.filters.authors) {
      filteredDocs = filteredDocs.filter(doc =>
        options.filters.authors.some((author: string) =>
          doc.author.toLowerCase().includes(author.toLowerCase())
        )
      );
    }
    
    if (options.filters.tags) {
      filteredDocs = filteredDocs.filter(doc =>
        options.filters.tags.some((tag: string) =>
          doc.tags.includes(tag)
        )
      );
    }
    
    if (options.filters.dateRange) {
      const start = new Date(options.filters.dateRange.start);
      const end = new Date(options.filters.dateRange.end);
      filteredDocs = filteredDocs.filter(doc => {
        const docDate = new Date(doc.createdAt);
        return docDate >= start && docDate <= end;
      });
    }
    
    if (options.filters.size) {
      if (options.filters.size.min) {
        filteredDocs = filteredDocs.filter(doc => doc.size >= options.filters.size.min);
      }
      if (options.filters.size.max) {
        filteredDocs = filteredDocs.filter(doc => doc.size <= options.filters.size.max);
      }
    }
  }

  // Calculate relevance scores based on query
  const queryTerms = options.query.toLowerCase().split(' ');
  const scoredDocs = filteredDocs.map(doc => {
    let score = 0;
    const searchableText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase();
    
    queryTerms.forEach(term => {
      const titleMatches = (doc.title.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      const contentMatches = (doc.content.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      const tagMatches = doc.tags.some(tag => tag.toLowerCase().includes(term)) ? 1 : 0;
      
      score += titleMatches * 3 + contentMatches * 1 + tagMatches * 2;
    });
    
    return { ...doc, relevanceScore: score };
  });

  // Filter by similarity threshold
  const thresholdScore = queryTerms.length * options.similarityThreshold;
  const relevantDocs = scoredDocs.filter(doc => doc.relevanceScore >= thresholdScore);

  // Sort results
  relevantDocs.sort((a, b) => {
    switch (options.sortBy) {
      case 'relevance':
        return options.sortOrder === 'desc' ? b.relevanceScore - a.relevanceScore : a.relevanceScore - b.relevanceScore;
      case 'date':
        return options.sortOrder === 'desc' 
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'title':
        return options.sortOrder === 'desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
      case 'author':
        return options.sortOrder === 'desc' ? b.author.localeCompare(a.author) : a.author.localeCompare(b.author);
      case 'size':
        return options.sortOrder === 'desc' ? b.size - a.size : a.size - b.size;
      default:
        return 0;
    }
  });

  const totalResults = relevantDocs.length;
  const paginatedResults = relevantDocs.slice(options.offset, options.offset + options.limit);

  return {
    results: paginatedResults,
    totalResults,
    hasMore: options.offset + options.limit < totalResults
  };
}

/**
 * Process search results to add snippets and highlights
 */
async function processSearchResults(
  searchResults: any,
  query: string,
  includeSnippets: boolean,
  highlightMatches: boolean
): Promise<any> {
  const queryTerms = query.toLowerCase().split(' ');
  
  const processedResults = searchResults.results.map((doc: any) => {
    const result = { ...doc };
    
    if (includeSnippets) {
      // Generate content snippet
      result.snippet = generateSnippet(doc.content, queryTerms, 200);
    }
    
    if (highlightMatches) {
      // Add highlights to title and snippet
      result.highlightedTitle = highlightText(doc.title, queryTerms);
      if (result.snippet) {
        result.highlightedSnippet = highlightText(result.snippet, queryTerms);
      }
    }
    
    return result;
  });
  
  // Group by source
  const sources = processedResults.reduce((acc: any, doc: any) => {
    acc[doc.source] = (acc[doc.source] || 0) + 1;
    return acc;
  }, {});
  
  return {
    results: processedResults,
    totalResults: searchResults.totalResults,
    hasMore: searchResults.hasMore,
    sources
  };
}

/**
 * Generate content snippet around matching terms
 */
function generateSnippet(content: string, queryTerms: string[], maxLength: number): string {
  if (!content || content.length <= maxLength) {
    return content;
  }
  
  // Find the best match position
  let bestPosition = 0;
  let maxMatches = 0;
  
  for (let i = 0; i <= content.length - maxLength; i += 20) {
    const segment = content.substring(i, i + maxLength).toLowerCase();
    const matches = queryTerms.reduce((count, term) => {
      return count + (segment.match(new RegExp(term, 'g')) || []).length;
    }, 0);
    
    if (matches > maxMatches) {
      maxMatches = matches;
      bestPosition = i;
    }
  }
  
  let snippet = content.substring(bestPosition, bestPosition + maxLength);
  
  // Ensure we don't cut off in the middle of a word
  if (bestPosition > 0) {
    const firstSpace = snippet.indexOf(' ');
    if (firstSpace > 0) {
      snippet = '...' + snippet.substring(firstSpace);
    }
  }
  
  if (bestPosition + maxLength < content.length) {
    const lastSpace = snippet.lastIndexOf(' ');
    if (lastSpace > 0) {
      snippet = snippet.substring(0, lastSpace) + '...';
    }
  }
  
  return snippet;
}

/**
 * Highlight matching terms in text
 */
function highlightText(text: string, queryTerms: string[]): string {
  let highlighted = text;
  
  queryTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });
  
  return highlighted;
}

/**
 * Generate search insights
 */
function generateSearchInsights(results: any, query: string): any {
  const insights = {
    totalSources: Object.keys(results.sources).length,
    mostRelevantSource: '',
    averageRelevance: 0,
    commonTags: [] as string[],
    timeDistribution: {} as any,
    suggestions: [] as string[]
  };
  
  if (results.results.length > 0) {
    // Find most relevant source
    insights.mostRelevantSource = Object.entries(results.sources)
      .sort(([,a]: any, [,b]: any) => b - a)[0][0];
    
    // Calculate average relevance
    insights.averageRelevance = results.results.reduce(
      (sum: number, doc: any) => sum + doc.relevanceScore, 0
    ) / results.results.length;
    
    // Find common tags
    const tagCounts: any = {};
    results.results.forEach((doc: any) => {
      doc.tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    insights.commonTags = Object.entries(tagCounts)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
    
    // Time distribution
    results.results.forEach((doc: any) => {
      const month = new Date(doc.createdAt).toISOString().substring(0, 7);
      insights.timeDistribution[month] = (insights.timeDistribution[month] || 0) + 1;
    });
  }
  
  // Generate suggestions
  if (results.results.length === 0) {
    insights.suggestions = [
      'Try using different keywords',
      'Check your filters - they might be too restrictive',
      'Expand your search to include more sources'
    ];
  } else if (results.results.length < 5) {
    insights.suggestions = [
      'Consider broadening your search terms',
      'Try using synonyms for your keywords',
      'Remove some filters to see more results'
    ];
  }
  
  return insights;
}

/**
 * Create search visualization data
 */
function createSearchVisualization(results: any): any {
  return {
    type: 'dashboard',
    title: 'Search Results Analysis',
    charts: [
      {
        type: 'pie',
        title: 'Results by Source',
        data: Object.entries(results.sources).map(([source, count]) => ({
          source,
          count
        }))
      },
      {
        type: 'histogram',
        title: 'Relevance Score Distribution',
        data: results.results.map((doc: any) => ({
          score: Math.round(doc.relevanceScore),
          count: 1
        }))
      },
      {
        type: 'timeline',
        title: 'Document Creation Timeline',
        data: results.results.map((doc: any) => ({
          date: doc.createdAt,
          title: doc.title,
          source: doc.source
        }))
      }
    ]
  };
}

/**
 * Search Documents Tool Definition
 */
export const searchDocumentsTool: ToolDefinition = {
  name: 'search_documents',
  displayName: 'Search Documents',
  description: 'Search across documents, knowledge base, and other content sources using semantic and keyword search',
  category: 'data',
  version: '1.0.0',
  icon: '🔍',
  tags: ['search', 'documents', 'semantic', 'knowledge', 'content'],
  author: 'PENNY Core',
  
  schema: SearchDocumentsParamsSchema,
  handler: searchDocumentsHandler,
  
  config: {
    requiresAuth: true,
    permissions: ['search:execute', 'documents:read'],
    rateLimit: {
      requests: 100,
      window: 3600 // 1 hour
    },
    timeout: 30000, // 30 seconds
    maxRetries: 2,
    cost: 5,
    cacheable: true,
    cacheTTL: 900, // 15 minutes
    showInMarketplace: true,
    featured: true
  },
  
  metadata: {
    examples: [
      {
        title: 'Basic document search',
        description: 'Search for financial reports',
        parameters: {
          query: 'quarterly financial results',
          sources: ['documents'],
          limit: 10
        }
      },
      {
        title: 'Advanced filtered search',
        description: 'Search with multiple filters and sources',
        parameters: {
          query: 'product roadmap strategy',
          sources: ['documents', 'knowledge_base', 'emails'],
          filters: {
            fileTypes: ['pdf', 'docx'],
            dateRange: {
              start: '2024-01-01T00:00:00Z',
              end: '2024-08-31T23:59:59Z'
            },
            tags: ['product', 'strategy']
          },
          searchType: 'hybrid',
          includeSnippets: true
        }
      }
    ],
    troubleshooting: [
      {
        issue: 'No results found',
        solution: 'Try using broader search terms, reduce filters, or check if you have access to the content sources.',
        category: 'common'
      },
      {
        issue: 'Too many irrelevant results',
        solution: 'Use more specific keywords, adjust the similarity threshold, or add relevant filters.',
        category: 'common'
      },
      {
        issue: 'Search is too slow',
        solution: 'Reduce the number of sources, limit the result count, or use more specific search terms.',
        category: 'performance'
      }
    ]
  }
};