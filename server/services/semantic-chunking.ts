import OpenAI from 'openai';
import { storage } from '../storage.ts';
import type { ContentChunk, InsertContentChunk, ManualTrainingContent, TrainingUrl } from '../../shared/schema.ts';

interface ChunkResult {
  chunks: string[];
  totalTokens: number;
}

interface SemanticChunk {
  text: string;
  index: number;
  tokenCount: number;
  embedding?: number[];
}

export class SemanticChunkingService {
  private openai: OpenAI;
  private readonly CHUNK_SIZE = 1500; // Target tokens per chunk
  private readonly CHUNK_OVERLAP = 200; // Overlap between chunks for context
  private readonly MIN_CHUNK_SIZE = 100; // Minimum viable chunk size

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for semantic chunking');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Intelligently chunk content using semantic boundaries
   * Preserves sentences, paragraphs, and logical sections
   */
  private chunkContentSemantically(content: string): ChunkResult {
    // Remove excessive whitespace and normalize
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    
    if (cleanContent.length < this.MIN_CHUNK_SIZE) {
      return {
        chunks: [cleanContent],
        totalTokens: this.estimateTokenCount(cleanContent)
      };
    }

    const chunks: string[] = [];
    let currentChunk = '';
    let totalTokens = 0;

    // Split into sentences first (preserving semantic boundaries)
    const sentences = cleanContent.split(/(?<=[.!?])\s+/);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      const tokenCount = this.estimateTokenCount(potentialChunk);

      // If adding this sentence would exceed our target size
      if (tokenCount > this.CHUNK_SIZE && currentChunk.length > 0) {
        // Add the current chunk and start a new one with overlap
        chunks.push(currentChunk.trim());
        totalTokens += this.estimateTokenCount(currentChunk);
        
        // Create overlap from the end of the previous chunk
        const overlapText = this.createOverlap(currentChunk, this.CHUNK_OVERLAP);
        currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add the final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
      totalTokens += this.estimateTokenCount(currentChunk);
    }

    return { chunks, totalTokens };
  }

  /**
   * Create overlap text from the end of a chunk to maintain context
   */
  private createOverlap(chunk: string, maxOverlapTokens: number): string {
    const words = chunk.split(' ');
    const overlapWords: string[] = [];
    let tokenCount = 0;

    // Work backwards from the end of the chunk
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      tokenCount += this.estimateTokenCount(word);
      
      if (tokenCount > maxOverlapTokens) break;
      overlapWords.unshift(word);
    }

    return overlapWords.join(' ');
  }

  /**
   * Rough token estimation (4 characters ≈ 1 token)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate embeddings for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`[SEMANTIC_CHUNKING] Generating embedding for text (${text.length} characters)`);
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[SEMANTIC_CHUNKING] Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Process and chunk training URL content
   */
  async processTrainingUrlContent(userId: string, trainingUrl: TrainingUrl): Promise<void> {
    if (!trainingUrl.crawledContent || trainingUrl.status !== 'completed') {
      console.log(`[SEMANTIC_CHUNKING] Skipping URL ${trainingUrl.url} - no content or not completed`);
      return;
    }

    console.log(`[SEMANTIC_CHUNKING] Processing URL: ${trainingUrl.url} (${trainingUrl.crawledContent.length} chars)`);

    // First, delete existing chunks for this source
    await this.deleteExistingChunks(userId, 'training_url', trainingUrl.id);

    // Chunk the content semantically
    const { chunks } = this.chunkContentSemantically(trainingUrl.crawledContent);
    
    console.log(`[SEMANTIC_CHUNKING] Created ${chunks.length} semantic chunks for ${trainingUrl.url}`);

    // Process each chunk
    const chunksToInsert: InsertContentChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      
      try {
        // Generate embedding for this chunk
        const embedding = await this.generateEmbedding(chunkText);
        
        chunksToInsert.push({
          userId,
          sourceType: 'training_url',
          sourceId: trainingUrl.id,
          chunkText,
          chunkIndex: i,
          embedding: JSON.stringify(embedding),
          tokenCount: this.estimateTokenCount(chunkText)
        });
      } catch (error) {
        console.error(`[SEMANTIC_CHUNKING] Failed to process chunk ${i} for URL ${trainingUrl.url}:`, error);
        // Continue with other chunks
      }
    }

    // Insert all chunks
    if (chunksToInsert.length > 0) {
      await storage.insertContentChunks(chunksToInsert);
      console.log(`[SEMANTIC_CHUNKING] Successfully processed ${chunksToInsert.length} chunks for ${trainingUrl.url}`);
    }
  }

  /**
   * Process and chunk manual training content
   */
  async processManualTrainingContent(userId: string, manualContent: ManualTrainingContent): Promise<void> {
    console.log(`[SEMANTIC_CHUNKING] Processing manual content: ${manualContent.title} (${manualContent.content.length} chars)`);

    // First, delete existing chunks for this source
    await this.deleteExistingChunks(userId, 'manual_content', manualContent.id);

    // Chunk the content semantically
    const { chunks } = this.chunkContentSemantically(manualContent.content);
    
    console.log(`[SEMANTIC_CHUNKING] Created ${chunks.length} semantic chunks for ${manualContent.title}`);

    // Process each chunk
    const chunksToInsert: InsertContentChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      
      try {
        // Generate embedding for this chunk
        const embedding = await this.generateEmbedding(chunkText);
        
        chunksToInsert.push({
          userId,
          sourceType: 'manual_content',
          sourceId: manualContent.id,
          chunkText,
          chunkIndex: i,
          embedding: JSON.stringify(embedding),
          tokenCount: this.estimateTokenCount(chunkText)
        });
      } catch (error) {
        console.error(`[SEMANTIC_CHUNKING] Failed to process chunk ${i} for manual content ${manualContent.title}:`, error);
        // Continue with other chunks
      }
    }

    // Insert all chunks
    if (chunksToInsert.length > 0) {
      await storage.insertContentChunks(chunksToInsert);
      console.log(`[SEMANTIC_CHUNKING] Successfully processed ${chunksToInsert.length} chunks for ${manualContent.title}`);
    }
  }

  /**
   * Delete existing chunks for a source before reprocessing
   */
  private async deleteExistingChunks(userId: string, sourceType: string, sourceId: string): Promise<void> {
    await storage.deleteContentChunks(userId, sourceType, sourceId);
  }

  /**
   * Reprocess all content for a user (useful for rebuilding the entire knowledge base)
   */
  async reprocessAllUserContent(userId: string): Promise<void> {
    console.log(`[SEMANTIC_CHUNKING] Reprocessing all content for user ${userId}`);

    // Process all training URLs
    const trainingUrls = await storage.getTrainingUrls(userId);
    if (trainingUrls) {
      for (const url of trainingUrls) {
        if (url.status === 'completed' && url.crawledContent) {
          await this.processTrainingUrlContent(userId, url);
        }
      }
    }

    // Process all manual content
    const manualContents = await storage.getManualTrainingContent(userId);
    if (manualContents) {
      for (const content of manualContents) {
        if (content.isActive) {
          await this.processManualTrainingContent(userId, content);
        }
      }
    }

    console.log(`[SEMANTIC_CHUNKING] Completed reprocessing all content for user ${userId}`);
  }

  /**
   * Find semantically similar content chunks using cosine similarity
   */
  async findSimilarChunks(userId: string, query: string, threshold: number = 0.75, limit: number = 10): Promise<{
    chunk: ContentChunk;
    similarity: number;
  }[]> {
    console.log(`[SEMANTIC_CHUNKING] Finding similar chunks for query: "${query.substring(0, 100)}..."`);

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get all chunks for the user
      const userChunks = await storage.getContentChunks(userId);
      
      if (!userChunks || userChunks.length === 0) {
        console.log('[SEMANTIC_CHUNKING] No chunks found for user');
        return [];
      }

      // Calculate similarity for each chunk
      const similarities: { chunk: ContentChunk; similarity: number }[] = [];
      
      for (const chunk of userChunks) {
        if (!chunk.embedding) continue;
        
        try {
          const chunkEmbedding = JSON.parse(chunk.embedding);
          const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
          
          if (similarity >= threshold) {
            similarities.push({ chunk, similarity });
          }
        } catch (error) {
          console.error(`[SEMANTIC_CHUNKING] Error parsing embedding for chunk ${chunk.id}:`, error);
        }
      }

      // Sort by similarity (highest first) and limit results
      similarities.sort((a, b) => b.similarity - a.similarity);
      const results = similarities.slice(0, limit);
      
      console.log(`[SEMANTIC_CHUNKING] Found ${results.length} similar chunks above threshold ${threshold}`);
      
      return results;
    } catch (error) {
      console.error('[SEMANTIC_CHUNKING] Error finding similar chunks:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

// Export singleton instance
export const semanticChunking = new SemanticChunkingService();