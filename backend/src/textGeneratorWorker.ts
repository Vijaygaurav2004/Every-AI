import { Ai } from '@cloudflare/ai';
import { saveToHistory } from './db';
import { D1Database } from '@cloudflare/workers-types';
import { fetchRelevantSources } from './sourceRetriever'; // You'll need to create this

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
        const { toolName, messages, firebaseUserId } = await request.json();
        console.log('Received request:', { toolName, firebaseUserId, messagesCount: messages.length });

        const ai = new Ai(env.AI);

        const systemMessage = {
          role: 'system',
          content: "You are an AI assistant that provides informative answers with citations. For each piece of information you include in your response, add a citation immediately after the relevant sentence using square brackets containing a number, like this[1]. At the end of your response, list the sources used, numbered to match the citations in the text. Always provide at least one source, and aim for 2-3 sources when possible. If you cannot find a reliable source for a piece of information, do not include that information in your response."
        };

        const allMessages = [systemMessage, ...messages];

        console.log('Running AI model for text generation');
        try {
          const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
            messages: allMessages
          });
          console.log('AI response:', response);

          if (typeof response === 'object' && 'response' in response) {
            const aiResponse = response.response;
            const [content, sourcesText] = aiResponse.split(/Sources:/i);

            const sources = sourcesText
              ? sourcesText.trim().split(/\n/)
                .map(source => {
                  const match = source.match(/^\d+\.\s*(.+?):\s*(https?:\/\/\S+)/);
                  return match ? { title: match[1], url: match[2] } : null;
                })
                .filter(Boolean)
              : [];

            const aiMessage = { 
              role: 'ai', 
              content: content.trim(), 
              type: 'text',
              sources: sources
            };

            if (env.DB) {
              try {
                await saveToHistory(env.DB, firebaseUserId, toolName, messages[messages.length - 1].content, 'text', JSON.stringify(aiMessage));
              } catch (dbError) {
                console.error('Error saving to history:', dbError);
              }
            } else {
              console.warn('DB binding is not available, skipping history save');
            }

            return new Response(JSON.stringify(aiMessage), {
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
      } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Failed to process request' }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
}

export async function generateText(prompt: string): Promise<{ content: string, sources: string[] }> {
  // Fetch relevant sources
  const relevantSources = await fetchRelevantSources(prompt);

  // Modify the prompt to include citation instructions
  const citationPrompt = `
    You are an AI assistant that provides informative answers with citations. 
    For each piece of information you include in your response, add a citation immediately after the relevant sentence using square brackets containing a number, like this[1]. 
    At the end of your response, list the sources used, numbered to match the citations in the text. 
    Always provide at least one source, and aim for 2-3 sources when possible. 
    If you cannot find a reliable source for a piece of information, do not include that information in your response.
    
    Use the following sources if relevant: ${relevantSources.join(', ')}
    
    User query: ${prompt}
  `;

  // Generate text using your existing method (e.g., API call or local model)
  const generatedText = await yourExistingTextGenerationMethod(citationPrompt);

  // Process the response to separate content and sources
  const { content, sources } = processResponse(generatedText);

  return { content, sources };
}

function processResponse(response: string): { content: string, sources: string[] } {
  const parts = response.split('\n\nSources:');
  const content = parts[0].trim();
  const sourcesText = parts[1] ? parts[1].trim() : '';
  const sources = sourcesText.split('\n').map(source => source.trim());
  return { content, sources };
}
