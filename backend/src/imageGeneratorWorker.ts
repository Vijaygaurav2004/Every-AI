// import { Ai } from '@cloudflare/ai';
// import { saveToHistory } from './db';
// import { D1Database } from '@cloudflare/workers-types';

// // Note: The Flux model (@cf/black-forest-labs/flux-1-schnell) generates square images (1:1 aspect ratio).
// // The aspect ratio parameter is used to adjust the prompt, but the generated image will always be square.
// // Cropping to the desired aspect ratio should be done on the client side.

// export interface Env {
//   AI: Ai;
//   DB: D1Database;
// }

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type",
// };

// export default {
//   async fetch(request: Request, env: Env): Promise<Response> {
//     if (request.method === "OPTIONS") {
//       return new Response(null, { headers: corsHeaders });
//     }

//     if (request.method === 'POST') {
//       try {
//         const { prompt, firebaseUserId, numSteps, aspectRatio, category } = await request.json();
//         console.log('Received image generation prompt:', prompt, 'Steps:', numSteps, 'Aspect Ratio:', aspectRatio, 'Category:', category);

//         if (!env.AI) {
//           throw new Error('AI binding is not available');
//         }

//         // const ai = new Ai(env.AI);
//         // let enhancedPrompt = generateCategoryPrompt(prompt, category);

//         // Modify prompt based on aspect ratio
//         if (aspectRatio === '16:9') {
//           enhancedPrompt += ' The image should be composed for a wide, landscape format.';
//         } else if (aspectRatio === '9:16') {
//           enhancedPrompt += ' The image should be composed for a tall, portrait format.';
//         }

//         const aiModel = '@cf/black-forest-labs/flux-1-schnell';

//         console.log('Sending request to AI model:', aiModel, 'with prompt:', enhancedPrompt);
//         const response = await ai.run('@cf/black-forest-labs/flux-1-schnell' as any, { 
//           prompt: enhancedPrompt,
//           num_steps: numSteps || 4
//         }) as unknown as { image: string };
        
//         console.log('AI response type:', typeof response);

//         if (typeof response === 'object' && 'image' in response) {
//           const imageData = response.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
          
//           // Save to history
//           if (env.DB) {
//             try {
//               await saveToHistory(env.DB, firebaseUserId, 'Image Generation', prompt, 'image', imageData);
//             } catch (dbError) {
//               console.error('Error saving to history:', dbError);
//             }
//           } else {
//             console.warn('DB binding is not available, skipping history save');
//           }

//           return new Response(JSON.stringify({ image: imageData }), {
//             headers: { 
//               'Content-Type': 'application/json',
//               ...corsHeaders,
//             },
//           });
//         } else {
//           throw new Error(`Unexpected response format from AI model: ${JSON.stringify(response)}`);
//         }
//       } catch (error) {
//         console.error('Error generating image:', error);
//         return new Response(JSON.stringify({ 
//           error: 'Failed to generate image', 
//           details: error instanceof Error ? error.message : String(error),
//           stack: error instanceof Error ? error.stack : undefined
//         }), {
//           status: 500,
//           headers: {
//             'Content-Type': 'application/json',
//             ...corsHeaders,
//           },
//         });
//       }
//     }

//     return new Response('Method not allowed', { status: 405, headers: corsHeaders });
//   },
// };

// // const generateCategoryPrompt = (basePrompt: string, category: string): string => {
// //   const categoryPrompts = {
// //     realistic: "Create a photorealistic image of",
// //     cartoon: "Generate a cartoon-style illustration of",
// //     anime: "Create an anime-style drawing of",
// //     painting: "Paint a detailed artistic representation of",
// //   };

// //   const categoryPrefix = categoryPrompts[category as keyof typeof categoryPrompts] || categoryPrompts.realistic;
// //   return `${categoryPrefix} ${basePrompt}. Focus on intricate details and accurate representation of the style.`;
// // };
