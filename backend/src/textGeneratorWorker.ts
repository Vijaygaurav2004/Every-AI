import { Ai } from '@cloudflare/ai';
import { saveToHistory } from './db';

export interface Env {
  AI: Ai;
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST') {
      try {
        const { messages, userId, toolName } = await request.json();
        console.log('Received text generation request:', { messagesCount: messages.length, userId, toolName });

        if (!env.AI) {
          throw new Error('AI binding is not available');
        }

        const ai = new Ai(env.AI);
        console.log('Sending request to AI model');
        const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', { 
          messages,
          max_tokens: 4000,
        });
        
        console.log('AI response:', JSON.stringify(response));

        if (typeof response === 'object' && 'response' in response) {
          // Save to history
          if (env.DB) {
            try {
              await saveToHistory(env.DB, userId, toolName, messages[messages.length - 1].content, 'text', response.response);
            } catch (dbError) {
              console.error('Error saving to history:', dbError);
              // Continue execution even if saving to history fails
            }
          } else {
            console.warn('DB binding is not available, skipping history save');
          }

          return new Response(JSON.stringify({ response: response.response }), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        } else {
          console.error('Unexpected response format:', JSON.stringify(response));
          throw new Error(`Unexpected response format from AI model: ${JSON.stringify(response)}`);
        }
      } catch (error) {
        console.error('Error generating text:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to generate text', 
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  },
};