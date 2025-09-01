import { semanticChunking } from './semantic-chunking.ts';
import { storage } from '../storage.ts';

interface SimilarContent {
  content: string;
  source: string;
  similarity: number;
  sourceType: 'training_url' | 'manual_content';
}

export class ProfessionalVectorEmbeddingsService {
  
  /**
   * Professional RAG implementation using semantic chunks
   * Treats all content sources equally with proper chunking
   */
  async getEnhancedRelevantKnowledge(userId: string, query: string): Promise<{
    relevantContent: string[];
    sources: string[];
    totalSources: number;
    hasTrainingData: boolean;
    method: 'semantic_chunks' | 'fallback' | 'none';
    avgSimilarity?: number;
    sourceTypes: string[];
  }> {
    
    console.log(`[PROFESSIONAL_RAG] Processing query: "${query.substring(0, 100)}..."`);
    
    try {
      // Step 1: Find semantically similar chunks using proper RAG
      const similarChunks = await semanticChunking.findSimilarChunks(userId, query, 0.70, 15);
      
      if (similarChunks.length > 0) {
        const avgSimilarity = similarChunks.reduce((sum, r) => sum + r.similarity, 0) / similarChunks.length;
        
        console.log(`[PROFESSIONAL_RAG] Found ${similarChunks.length} semantic chunks with avg similarity ${avgSimilarity.toFixed(3)}`);
        
        // Get source information for each chunk
        const results: SimilarContent[] = [];
        const sourceTypes = new Set<string>();
        
        for (const { chunk, similarity } of similarChunks) {
          let sourceName = 'Unknown Source';
          
          // Get human-readable source name
          if (chunk.sourceType === 'training_url') {
            const urls = await storage.getTrainingUrls(userId);
            const url = urls?.find(u => u.id === chunk.sourceId);
            sourceName = url?.url || 'Training URL';
          } else if (chunk.sourceType === 'manual_content') {
            const manualContents = await storage.getManualTrainingContent(userId);
            const content = manualContents?.find(c => c.id === chunk.sourceId);
            sourceName = content?.title || 'Manual Content';
          }
          
          sourceTypes.add(chunk.sourceType);
          
          results.push({
            content: chunk.chunkText,
            source: sourceName,
            similarity,
            sourceType: chunk.sourceType as 'training_url' | 'manual_content'
          });
        }
        
        return {
          relevantContent: results.map(r => r.content),
          sources: results.map(r => r.source),
          totalSources: results.length,
          hasTrainingData: true,
          method: 'semantic_chunks',
          avgSimilarity: Math.round(avgSimilarity * 100) / 100,
          sourceTypes: Array.from(sourceTypes)
        };
      }
      
      // Step 2: Fallback to text matching if no semantic matches
      console.log('[PROFESSIONAL_RAG] No semantic matches found, falling back to text matching');
      
      const trainingUrls = await storage.getTrainingUrls(userId);
      const manualContents = await storage.getManualTrainingContent(userId);
      
      if ((!trainingUrls || trainingUrls.length === 0) && (!manualContents || manualContents.length === 0)) {
        return {
          relevantContent: [],
          sources: [],
          totalSources: 0,
          hasTrainingData: false,
          method: 'none',
          sourceTypes: []
        };
      }
      
      // Simple text matching fallback
      const queryTerms = this.extractKeyTerms(query);
      const textMatches: SimilarContent[] = [];
      
      // Check training URLs
      if (trainingUrls) {
        for (const url of trainingUrls) {
          if (url.status === 'completed' && url.crawledContent) {
            const content = url.crawledContent.toLowerCase();
            const relevanceScore = this.calculateTextRelevanceScore(content, queryTerms);
            
            if (relevanceScore > 0) {
              // Extract relevant excerpt from content
              const excerpt = this.extractRelevantExcerpt(url.crawledContent, queryTerms);
              textMatches.push({
                content: excerpt,
                source: url.url,
                similarity: relevanceScore,
                sourceType: 'training_url'
              });
            }
          }
        }
      }
      
      // Check manual content
      if (manualContents) {
        for (const manual of manualContents) {
          if (manual.isActive) {
            const content = manual.content.toLowerCase();
            const relevanceScore = this.calculateTextRelevanceScore(content, queryTerms);
            
            if (relevanceScore > 0) {
              const excerpt = this.extractRelevantExcerpt(manual.content, queryTerms);
              textMatches.push({
                content: excerpt,
                source: manual.title,
                similarity: relevanceScore,
                sourceType: 'manual_content'
              });
            }
          }
        }
      }
      
      // Sort by relevance and limit results
      textMatches.sort((a, b) => b.similarity - a.similarity);
      const topMatches = textMatches.slice(0, 8);
      
      if (topMatches.length > 0) {
        const sourceTypes = Array.from(new Set(topMatches.map(m => m.sourceType)));
        
        return {
          relevantContent: topMatches.map(m => m.content),
          sources: topMatches.map(m => m.source),
          totalSources: topMatches.length,
          hasTrainingData: true,
          method: 'fallback',
          sourceTypes
        };
      }
      
      return {
        relevantContent: [],
        sources: [],
        totalSources: 0,
        hasTrainingData: false,
        method: 'none',
        sourceTypes: []
      };
      
    } catch (error) {
      console.error('[PROFESSIONAL_RAG] Error in knowledge retrieval:', error);
      return {
        relevantContent: [],
        sources: [],
        totalSources: 0,
        hasTrainingData: false,
        method: 'none',
        sourceTypes: []
      };
    }
  }
  
  /**
   * Extract key terms from query for text matching
   */
  private extractKeyTerms(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
      'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term))
      .slice(0, 10); // Limit to top 10 terms
  }
  
  /**
   * Calculate text relevance score using keyword matching
   */
  private calculateTextRelevanceScore(content: string, queryTerms: string[]): number {
    let score = 0;
    const contentLower = content.toLowerCase();
    
    for (const term of queryTerms) {
      const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += occurrences;
    }
    
    return score;
  }
  
  /**
   * Extract relevant excerpt around matching terms
   */
  private extractRelevantExcerpt(content: string, queryTerms: string[], maxLength: number = 2000): string {
    const contentLower = content.toLowerCase();
    let bestMatch = { start: 0, score: 0 };
    
    // Find the best matching section
    for (let i = 0; i < content.length - maxLength; i += 500) {
      const section = contentLower.substring(i, i + maxLength);
      let score = 0;
      
      for (const term of queryTerms) {
        const matches = (section.match(new RegExp(term, 'g')) || []).length;
        score += matches;
      }
      
      if (score > bestMatch.score) {
        bestMatch = { start: i, score };
      }
    }
    
    // Extract the excerpt
    let excerpt = content.substring(bestMatch.start, bestMatch.start + maxLength);
    
    // Trim to complete sentences
    const lastPeriod = excerpt.lastIndexOf('.');
    if (lastPeriod > maxLength / 2) {
      excerpt = excerpt.substring(0, lastPeriod + 1);
    }
    
    return excerpt.trim();
  }
}

// Export singleton instance
export const professionalVectorEmbeddings = new ProfessionalVectorEmbeddingsService();