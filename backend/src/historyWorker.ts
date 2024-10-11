import { initializeDatabase, getUserHistory } from './db';
import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const firebaseUserId = url.searchParams.get('firebaseUserId');
      
      if (!firebaseUserId) {
        return new Response(JSON.stringify({ error: 'Firebase User ID is required' }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      try {
        console.log('Attempting to fetch history for user:', firebaseUserId);
        
        if (!env.DB) {
          throw new Error('Database binding is not available');
        }

        // Initialize the database
        try {
          await initializeDatabase(env.DB);
          console.log('Database initialized successfully');
        } catch (initError) {
          console.error('Error initializing database:', initError);
          throw new Error(`Failed to initialize database: ${initError instanceof Error ? initError.message : String(initError)}`);
        }

        const history = await getUserHistory(env.DB, firebaseUserId);
        console.log('History fetched:', JSON.stringify(history));
        const response = JSON.stringify({ results: history.results });
        console.log('Sending response:', response);
        return new Response(response, {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      } catch (error) {
        console.error('Error fetching history:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch history', 
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  },
};