import { Router, Request, Response } from 'express';
import { sentimentAnalysisService } from '../services/sentiment-analysis';
import { contentSafetyService } from '../services/content-safety';
import { storage } from '../storage';

const router = Router();

// Simple auth middleware
const requireAuth = async (req: any, res: Response, next: any) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Test sentiment analysis endpoint
 */
router.post('/api/test-sentiment', requireAuth, async (req: any, res: Response) => {
  try {
    const { text, context = 'email_response' } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      });
    }

    // Test individual sentiment analysis
    const sentimentResult = await sentimentAnalysisService.analyzeSentiment(text);
    
    // Test guard rails
    const guardRailResult = await sentimentAnalysisService.applyGuardRails(text, context);
    
    // Test full content safety validation
    const fullValidation = await contentSafetyService.validateResponse(text, req.user.id, context);

    res.json({
      success: true,
      results: {
        sentiment: sentimentResult,
        guardRails: guardRailResult,
        fullValidation: fullValidation,
        serviceInfo: sentimentAnalysisService.getServiceInfo()
      }
    });

  } catch (error) {
    console.error('Sentiment test error:', error);
    res.status(500).json({
      success: false,
      error: 'Sentiment analysis test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Validate AWS connection endpoint
 */
router.post('/api/validate-aws-connection', requireAuth, async (req: any, res: Response) => {
  try {
    const isConnected = await sentimentAnalysisService.validateConnection();
    const serviceInfo = sentimentAnalysisService.getServiceInfo();

    res.json({
      success: true,
      connected: isConnected,
      serviceInfo
    });

  } catch (error) {
    console.error('AWS connection validation error:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as sentimentTestRouter };