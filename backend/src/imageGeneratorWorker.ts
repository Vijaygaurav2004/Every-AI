import { Ai } from '@cloudflare/ai';
import { saveToHistory } from './db';
import { D1Database } from '@cloudflare/workers-types';

// Note: The Flux model (@cf/black-forest-labs/flux-1-schnell) generates square images (1:1 aspect ratio).
// The aspect ratio parameter is used to adjust the prompt, but the generated image will always be square.
// Cropping to the desired aspect ratio should be done on the client side.

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
        const { prompt, userId, numSteps, aspectRatio } = await request.json();
        console.log('Received image generation prompt:', prompt, 'Steps:', numSteps, 'Aspect Ratio:', aspectRatio);

        if (!env.AI) {
          throw new Error('AI binding is not available');
        }

        const ai = new Ai(env.AI);
        let enhancedPrompt = `Create a highly detailed, photorealistic image of ${prompt}. Focus on intricate textures, accurate lighting, and lifelike details.`;
        
        // Modify prompt based on aspect ratio
        if (aspectRatio === '16:9') {
          enhancedPrompt += ' The image should be composed for a wide, landscape format.';
        } else if (aspectRatio === '9:16') {
          enhancedPrompt += ' The image should be composed for a tall, portrait format.';
        }

        const aiModel = '@cf/black-forest-labs/flux-1-schnell';

        console.log('Sending request to AI model:', aiModel, 'with prompt:', enhancedPrompt);
        const response = await ai.run(aiModel, { 
          prompt: enhancedPrompt,
          num_steps: numSteps || 4
        }) as { image: string };
        
        console.log('AI response type:', typeof response);

        if (typeof response === 'object' && 'image' in response) {
          const imageData = response.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
          
          // Save to history
          if (env.DB) {
            try {
              await saveToHistory(env.DB, userId, 'Image Generation', prompt, 'image', imageData);
            } catch (dbError) {
              console.error('Error saving to history:', dbError);
            }
          } else {
            console.warn('DB binding is not available, skipping history save');
          }

          return new Response(JSON.stringify({ image: imageData }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        } else {
          throw new Error(`Unexpected response format from AI model: ${JSON.stringify(response)}`);
        }
      } catch (error) {
        console.error('Error generating image:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to generate image', 
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