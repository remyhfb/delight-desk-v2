import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';
import { logger, LogCategory } from './logger';

export interface ScrapedContent {
  title: string;
  mainContent: string;
  faqItems: Array<{
    question: string;
    answer: string;
  }>;
  metadata: {
    url: string;
    scrapedAt: Date;
    contentLength: number;
    method: 'static' | 'dynamic';
  };
}

export class AdvancedWebScraper {
  
  /**
   * Scrape content from a URL using the most appropriate method
   */
  async scrapeContent(url: string): Promise<ScrapedContent> {
    logger.info(LogCategory.SYSTEM, 'Starting content extraction', { url });
    
    try {
      // First attempt: Try static scraping (faster)
      const staticResult = await this.scrapeStatic(url);
      
      // Check if static scraping found meaningful FAQ content
      if (staticResult.faqItems.length > 0) {
        logger.info(LogCategory.SYSTEM, 'Static scraping successful', { 
          url, 
          faqCount: staticResult.faqItems.length,
          method: 'static'
        });
        return staticResult;
      }
      
      // Fallback: Dynamic scraping with Puppeteer for JavaScript-heavy pages
      logger.info(LogCategory.SYSTEM, 'Static scraping insufficient, trying dynamic scraping', { url });
      const dynamicResult = await this.scrapeDynamic(url);
      
      logger.info(LogCategory.SYSTEM, 'Dynamic scraping completed', {
        url,
        faqCount: dynamicResult.faqItems.length,
        method: 'dynamic'
      });
      
      return dynamicResult;
      
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Scraping failed', { url, error });
      throw error;
    }
  }
  
  /**
   * Static scraping for simple HTML content
   */
  private async scrapeStatic(url: string): Promise<ScrapedContent> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DelightDesk-AI-Training/2.0 (Professional content crawler for customer service AI)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Extract title
    const title = document.querySelector('title')?.textContent?.trim() || '';
    
    // Extract FAQ content using multiple strategies
    const faqItems = this.extractFAQContent(document);
    
    // Extract general page content
    const mainContent = this.extractMainContent(document);
    
    return {
      title,
      mainContent,
      faqItems,
      metadata: {
        url,
        scrapedAt: new Date(),
        contentLength: mainContent.length,
        method: 'static'
      }
    };
  }
  
  /**
   * Dynamic scraping with Puppeteer for JavaScript-rendered content
   */
  private async scrapeDynamic(url: string): Promise<ScrapedContent> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Set realistic viewport and user agent
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 DelightDesk-AI-Training/2.0');
      
      // Navigate and wait for content to load
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      // Wait for potential lazy-loaded content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to expand all accordion items/dropdowns
      await this.expandAccordionItems(page);
      
      // Extract content after JavaScript execution
      const extractedData = await page.evaluate(() => {
        // Helper function to clean text
        const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();
        
        // Extract title
        const title = document.querySelector('title')?.textContent?.trim() || '';
        
        // Extract FAQ items using multiple selectors
        const faqItems: Array<{question: string, answer: string}> = [];
        
        // Strategy 1: Look for common FAQ patterns
        const faqSelectors = [
          // Generic accordion patterns
          '[data-accordion] .accordion-item',
          '.accordion .accordion-item',
          '.faq-item',
          '.faq-question-answer',
          
          // WordPress/Divi specific
          '.et_pb_toggle',
          '.et_pb_accordion_item',
          
          // Common FAQ structures
          '.faq-container > div',
          '[class*="faq"] [class*="item"]',
          '[class*="question"]'
        ];
        
        for (const selector of faqSelectors) {
          const items = document.querySelectorAll(selector);
          
          items.forEach(item => {
            // Try different patterns to extract Q&A
            let question = '';
            let answer = '';
            
            // Pattern 1: Direct question/answer elements
            const questionEl = item.querySelector('[class*="question"], .title, h3, h4, .toggle-title, .accordion-title');
            const answerEl = item.querySelector('[class*="answer"], .content, .toggle-content, .accordion-content, p');
            
            if (questionEl && answerEl) {
              question = cleanText(questionEl.textContent || '');
              answer = cleanText(answerEl.textContent || '');
            }
            // Pattern 2: All text in item, split by common patterns
            else if (item.textContent) {
              const fullText = cleanText(item.textContent);
              // Look for question-like patterns
              if (fullText.includes('?') && fullText.length > 20 && fullText.length < 1000) {
                const parts = fullText.split('?');
                if (parts.length >= 2) {
                  question = (parts[0] + '?').trim();
                  answer = parts.slice(1).join('?').trim();
                }
              }
            }
            
            // Only add if we have both question and answer
            if (question && answer && question.length > 10 && answer.length > 20) {
              faqItems.push({ question, answer });
            }
          });
          
          // If we found FAQs, break
          if (faqItems.length > 0) break;
        }
        
        // Strategy 2: Look for visible text that looks like FAQ content
        if (faqItems.length === 0) {
          const allText = document.body.textContent || '';
          const lines = allText.split('\n').map(line => cleanText(line)).filter(line => line.length > 10);
          
          let currentQuestion = '';
          for (const line of lines) {
            // If line ends with ? and is reasonable length, it might be a question
            if (line.endsWith('?') && line.length > 15 && line.length < 200) {
              if (currentQuestion) {
                // Previous question didn't get an answer, skip it
              }
              currentQuestion = line;
            }
            // If we have a current question and this line looks like an answer
            else if (currentQuestion && line.length > 30 && line.length < 1000 && !line.startsWith('http')) {
              faqItems.push({
                question: currentQuestion,
                answer: line
              });
              currentQuestion = '';
              
              // Limit to prevent too much content
              if (faqItems.length >= 20) break;
            }
          }
        }
        
        // Extract main content
        const contentSelectors = [
          'main',
          '[role="main"]',
          '.main-content',
          '.content',
          '.page-content',
          '.entry-content',
          '.post-content'
        ];
        
        let mainContent = '';
        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            mainContent = cleanText(element.textContent);
            break;
          }
        }
        
        // Fallback to body content
        if (!mainContent) {
          mainContent = cleanText(document.body.textContent || '');
        }
        
        return {
          title,
          mainContent: mainContent.slice(0, 10000), // Limit size
          faqItems: faqItems.slice(0, 50) // Limit FAQ items
        };
      });
      
      return {
        ...extractedData,
        metadata: {
          url,
          scrapedAt: new Date(),
          contentLength: extractedData.mainContent.length,
          method: 'dynamic'
        }
      };
      
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Try to expand accordion items on the page
   */
  private async expandAccordionItems(page: any): Promise<void> {
    try {
      // Common accordion toggle selectors
      const toggleSelectors = [
        '[data-toggle="collapse"]',
        '.accordion-toggle',
        '.toggle-title',
        '.accordion-title',
        '.faq-question',
        '[class*="toggle"]',
        '[class*="accordion"] button',
        '[class*="collapse"] button'
      ];
      
      for (const selector of toggleSelectors) {
        try {
          await page.evaluate((sel: string) => {
            const elements = document.querySelectorAll(sel);
            elements.forEach(element => {
              if (element instanceof HTMLElement) {
                element.click();
              }
            });
          }, selector);
          
          // Wait a bit after clicking
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          // Ignore errors for individual selectors
          logger.debug('AdvancedWebScraper', 'Toggle selector failed', { selector, error });
        }
      }
      
      // Wait for animations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Failed to expand accordions', { error });
    }
  }
  
  /**
   * Extract FAQ content from a DOM document
   */
  private extractFAQContent(document: Document): Array<{question: string, answer: string}> {
    const faqItems: Array<{question: string, answer: string}> = [];
    
    // Try multiple FAQ extraction strategies
    const strategies = [
      this.extractFromAccordion.bind(this),
      this.extractFromDefinitionList.bind(this),
      this.extractFromHeadingsAndParagraphs.bind(this),
      this.extractFromGenericPatterns.bind(this)
    ];
    
    for (const strategy of strategies) {
      try {
        const items = strategy(document);
        if (items.length > 0) {
          faqItems.push(...items);
          break; // Use first successful strategy
        }
      } catch (error) {
        logger.debug('AdvancedWebScraper', 'FAQ extraction strategy failed', { error });
      }
    }
    
    return faqItems.slice(0, 50); // Limit to 50 FAQ items
  }
  
  private extractFromAccordion(document: Document): Array<{question: string, answer: string}> {
    const items: Array<{question: string, answer: string}> = [];
    
    // Common accordion selectors
    const accordionSelectors = [
      '.accordion .accordion-item',
      '.et_pb_toggle',
      '.et_pb_accordion_item',
      '[data-accordion] > div',
      '.faq-item'
    ];
    
    for (const selector of accordionSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach(element => {
        const questionEl = element.querySelector('.title, .toggle-title, .accordion-title, h3, h4, [class*="question"]');
        const answerEl = element.querySelector('.content, .toggle-content, .accordion-content, [class*="answer"], p');
        
        if (questionEl?.textContent && answerEl?.textContent) {
          items.push({
            question: questionEl.textContent.trim(),
            answer: answerEl.textContent.trim()
          });
        }
      });
      
      if (items.length > 0) break;
    }
    
    return items;
  }
  
  private extractFromDefinitionList(document: Document): Array<{question: string, answer: string}> {
    const items: Array<{question: string, answer: string}> = [];
    
    const dlElements = document.querySelectorAll('dl');
    dlElements.forEach(dl => {
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        const question = dts[i]?.textContent?.trim();
        const answer = dds[i]?.textContent?.trim();
        
        if (question && answer) {
          items.push({ question, answer });
        }
      }
    });
    
    return items;
  }
  
  private extractFromHeadingsAndParagraphs(document: Document): Array<{question: string, answer: string}> {
    const items: Array<{question: string, answer: string}> = [];
    
    const headings = document.querySelectorAll('h2, h3, h4, h5');
    headings.forEach(heading => {
      const question = heading.textContent?.trim();
      if (question && question.includes('?')) {
        // Look for the next paragraph or content
        let nextElement = heading.nextElementSibling;
        let answer = '';
        
        while (nextElement) {
          if (nextElement.tagName.match(/^H[2-6]$/)) {
            // Hit another heading, stop
            break;
          }
          
          if (nextElement.textContent?.trim()) {
            answer += nextElement.textContent.trim() + ' ';
          }
          
          nextElement = nextElement.nextElementSibling;
        }
        
        if (answer.trim()) {
          items.push({
            question,
            answer: answer.trim()
          });
        }
      }
    });
    
    return items;
  }
  
  private extractFromGenericPatterns(document: Document): Array<{question: string, answer: string}> {
    const items: Array<{question: string, answer: string}> = [];
    
    // Look for any element that contains question-like text
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && text.includes('?') && text.length > 20 && text.length < 500) {
        // Check if this might be a question
        const questionMatch = text.match(/^[^?]*\?/);
        if (questionMatch) {
          const question = questionMatch[0].trim();
          const remainingText = text.substring(questionMatch[0].length).trim();
          
          if (remainingText.length > 20) {
            items.push({
              question,
              answer: remainingText
            });
          }
        }
      }
    });
    
    return items;
  }
  
  private extractMainContent(document: Document): string {
    // Try to get main content from common containers
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.page-content',
      '.entry-content',
      '.post-content',
      'article'
    ];
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return this.cleanText(element.textContent);
      }
    }
    
    // Fallback to body
    return this.cleanText(document.body.textContent || '');
  }
  
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
}