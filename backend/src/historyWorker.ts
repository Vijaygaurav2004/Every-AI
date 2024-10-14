import { R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  HISTORY_BUCKET: R2Bucket;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    console.log('Received request:', request.method, path);

    if (path === '/history' && request.method === 'GET') {
      const userId = url.searchParams.get('firebaseUserId');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        console.log('Fetching history for user:', userId);
        if (!env.HISTORY_BUCKET) {
          throw new Error('HISTORY_BUCKET is not defined');
        }

        console.log('Listing objects from R2 bucket');
        const objects = await env.HISTORY_BUCKET.list({ prefix: `${userId}/` });
        console.log('Objects found:', objects.objects.length);

        const results = await Promise.all(
          objects.objects.map(async (obj) => {
            console.log('Fetching object:', obj.key);
            const item = await env.HISTORY_BUCKET.get(obj.key);
            if (item === null) {
              console.log('Object not found:', obj.key);
              return null;
            }
            const data = await item.text();
            return JSON.parse(data);
          })
        );
        const filteredResults = results.filter(item => item !== null);
        
        // Group conversations by tool type (text or image)
        const groupedResults = {
          text: filteredResults.filter(item => !['DALL-E', 'Stable Diffusion'].includes(item.tool)),
          image: filteredResults.filter(item => ['DALL-E', 'Stable Diffusion'].includes(item.tool))
        };

        return new Response(JSON.stringify(groupedResults), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error('Error fetching history:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch history', details: error.message, stack: error.stack }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (path === '/history' && request.method === 'POST') {
      try {
        console.log('Received POST request to save conversation');
        const { userId, tool, messages, timestamp } = await request.json();
        console.log('Received data:', { userId, tool, messagesCount: messages.length, timestamp });
        const id = `${userId}/${tool}_${timestamp}`;
        
        // We're no longer checking for existing items, as we want to save the entire conversation

        const data = JSON.stringify({ id, userId, tool, messages, timestamp });
        await env.HISTORY_BUCKET.put(id, data);
        console.log('Conversation saved with id:', id);
        return new Response(JSON.stringify({ message: 'Conversation saved successfully', id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error('Error saving conversation:', error);
        return new Response(JSON.stringify({ error: 'Failed to save conversation', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (path === '/history' && request.method === 'DELETE') {
      try {
        const { id } = await request.json();
        console.log('Received delete request for id:', id);
        if (!id) {
          return new Response(JSON.stringify({ error: 'Conversation ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log('Attempting to delete conversation:', id);
        
        const object = await env.HISTORY_BUCKET.get(id);
        
        if (object === null) {
          console.log('No object found with id:', id);
          return new Response(JSON.stringify({ error: 'Conversation not found' }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await env.HISTORY_BUCKET.delete(id);
        
        console.log('Conversation deleted:', id);
        return new Response(JSON.stringify({ message: 'Conversation deleted successfully' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error('Error deleting conversation:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete conversation', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log('Route not found');
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
