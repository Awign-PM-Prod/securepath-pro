import { supabase } from '@/integrations/supabase/client';

export interface OpenAIResponse {
  success: boolean;
  response?: string;
  error?: string;
  fullResponse?: any;
}

export class OpenAIService {
  /**
   * Send a prompt to OpenAI API and get response
   * @param prompt - The text prompt to send to OpenAI
   * @param model - Optional model name (defaults to 'gpt-3.5-turbo')
   */
  async chat(prompt: string, model?: string): Promise<OpenAIResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('openai-chat', {
        body: {
          prompt,
          model: model || 'gpt-3.5-turbo',
        },
      });

      if (error) throw error;

      return data as OpenAIResponse;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get response from OpenAI',
      };
    }
  }

  /**
   * Generate a 4-line summary of a verification report from form submission data
   * @param formData - JSON object containing questions and answers (excluding images/signatures)
   * @returns Summary text (4 lines)
   */
  async generateReportSummary(formData: { questions_and_answers: Array<{ question: string; answer: string }> }): Promise<OpenAIResponse> {
    try {
      const prompt = `Based on the following verification report data in JSON format, create a concise 4-line summary highlighting the key findings. Format the response as exactly 4 lines, each line being a complete sentence.

Report Data:
${JSON.stringify(formData, null, 2)}

Summary (4 lines):`;

      return await this.chat(prompt);
    } catch (error) {
      console.error('Error generating report summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate report summary',
      };
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();

