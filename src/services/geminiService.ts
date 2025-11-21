import { supabase } from '@/integrations/supabase/client';

export interface GeminiResponse {
  success: boolean;
  response?: string;
  error?: string;
  fullResponse?: any;
}

export class GeminiService {
  /**
   * Send a prompt to Gemini API and get response
   * @param prompt - The text prompt to send to Gemini
   * @param model - Optional model name (defaults to 'gemini-2.5-flash')
   */
  async chat(prompt: string, model?: string): Promise<GeminiResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          prompt,
          model: model || 'gemini-2.5-flash',
        },
      });

      if (error) throw error;

      return data as GeminiResponse;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get response from Gemini',
      };
    }
  }

  /**
   * Generate a 4-line summary of a verification report from form submission data
   * @param formData - JSON object containing questions and answers (excluding images/signatures)
   * @returns Summary text (4 lines)
   */
  async generateReportSummary(formData: { questions_and_answers: Array<{ question: string; answer: string }> }): Promise<GeminiResponse> {
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
export const geminiService = new GeminiService();

