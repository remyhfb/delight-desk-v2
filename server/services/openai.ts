import OpenAI from "openai";

class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateFromInstructions(
    instructions: string,
    query: string,
    companyName: string,
    orderData?: any,
    subscriptionData?: any,
    signatureContext?: string,
    userId?: string
  ): Promise<string> {
    try {
      const prompt = `You are a customer service AI assistant for ${companyName}.

Instructions: ${instructions}

Customer Query: ${query}

${orderData ? `Order Information: ${JSON.stringify(orderData, null, 2)}` : ""}
${subscriptionData ? `Subscription Information: ${JSON.stringify(subscriptionData, null, 2)}` : ""}

Respond with just the email content ${signatureContext ? "(including the required email signature)" : "(no subject line, no signatures - just the body text)"}:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert customer service email writer. Generate responses that are consistent with the company's established communication style while following specific agent instructions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 600
      });

      let responseText = response.choices[0].message.content?.trim() || "I apologize, but I'm unable to generate a response at this time. Please contact our support team directly.";
      
      // Note: Emoji filtering available via removeEmojis() when needed
      
      return responseText;
    } catch (error) {
      console.error('OpenAI generateFromInstructions error:', error);
      throw new Error('Failed to generate response from instructions');
    }
  }
}

export const openaiService = new OpenAIService();
export { OpenAIService };

