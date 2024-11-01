import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Send, Image as ImageIcon, ArrowLeft, Download, User, MessageCircle, Loader, X } from 'lucide-react'
import { TEXT_API_URL, IMAGE_API_URL, HISTORY_API_URL, PERPLEXITY_API_KEY, OPENROUTER_API_KEY, OPENROUTER_API_URL, GROQ_API_KEY } from '../config'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '../firebase'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip } from './ui/tooltip'
import RobotThinking from './RobotThinking'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { saveConversation } from '../utils/historyUtils'
import rehypeRaw from 'rehype-raw';
import Groq from 'groq-sdk';
import { Plugin } from 'unified';

interface ToolInterfaceProps {
  toolName: string
  onBack: () => void
  userId: string
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  type: 'text' | 'image';
  imageUrl?: string;
}

// Add this function at the top of the file, outside the component
const generateCategoryPrompt = (basePrompt: string, category: string): string => {
  const categoryPrompts = {
    realistic: "Create a photorealistic image of",
    cartoon: "Generate a cartoon-style illustration of",
    anime: "Create an anime-style drawing of",
    painting: "Paint a detailed artistic representation of",
  };

  const categoryPrefix = categoryPrompts[category as keyof typeof categoryPrompts] || categoryPrompts.realistic;
  return `${categoryPrefix} ${basePrompt}. Focus on intricate details and accurate representation of the style.`;
};

const ToolInterface: React.FC<ToolInterfaceProps> = ({ toolName, onBack, userId }) => {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [numSteps, setNumSteps] = useState(4)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [showNote, setShowNote] = useState(true)

  const isTextTool = ['Llama-3.2', 'GPT-4', 'Claude', 'Copilot', 'Runway', 'Whisper', 'Gemini Pro 1.5', 'Groq'].includes(toolName);
  const isImageTool = toolName === 'DALL-E' || toolName === 'Stable Diffusion'

  const [category, setCategory] = useState('realistic')

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [blogTopic, setBlogTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState('professional');

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [messages])

  const getImageDimensions = (ratio: string) => {
    switch (ratio) {
      case '1:1':
        return { width: 512, height: 512 };
      case '9:16':
        return { width: 384, height: 640 };
      case '16:9':
        return { width: 640, height: 384 };
      default:
        return { width: 512, height: 512 };
    }
  };

  const cropImage = (imageUrl: string, aspectRatio: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Unable to get 2D context'));
          return;
        }

        let targetWidth: number, targetHeight: number;
        if (aspectRatio === '1:1') {
          targetWidth = targetHeight = Math.min(img.width, img.height);
        } else if (aspectRatio === '16:9') {
          targetHeight = img.height;
          targetWidth = targetHeight * (16 / 9);
        } else if (aspectRatio === '9:16') {
          targetWidth = img.width;
          targetHeight = targetWidth * (16 / 9);
        } else {
          targetWidth = targetHeight = Math.min(img.width, img.height);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const sourceX = (img.width - targetWidth) / 2;
        const sourceY = (img.height - targetHeight) / 2;

        ctx.drawImage(img, sourceX, sourceY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  const sendMessage = async () => {
    if (input.trim() || selectedImage) {
      const newMessage: Message = {
        role: 'user',
        content: selectedImage ? 'Image uploaded by user' : input.trim(),
        type: selectedImage ? 'image' : 'text',
        imageUrl: selectedImage || undefined
      };
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      setIsLoading(true);

      try {
        await saveConversation(userId, toolName, [newMessage]);

        let response;
        if (['Llama-3.2', 'Claude', 'GPT-4', 'Copilot', 'Whisper', 'Runway'].includes(toolName)) {
          const openRouterResponse = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "HTTP-Referer": `${window.location.origin}`,
              "X-Title": "Every AI",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              "model": "meta-llama/llama-3.2-11b-vision-instruct",
              "messages": [
                {
                  "role": "user",
                  "content": [
                    {
                      "type": "text",
                      "text": selectedImage ? "Describe this image in detail, including any text, objects, colors, and notable features." : newMessage.content
                    },
                    ...(selectedImage ? [{
                      "type": "image_url",
                      "image_url": {
                        "url": selectedImage
                      }
                    }] : [])
                  ]
                }
              ]
            })
          });
          const data = await openRouterResponse.json();
          console.log('OpenRouter API response:', data);

          if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            response = { response: data.choices[0].message.content };
          } else if (data.error) {
            throw new Error(`API Error: ${data.error.message}`);
          } else {
            throw new Error(`Unexpected response format from OpenRouter API: ${JSON.stringify(data)}`);
          }
        } else if (toolName === 'Gemini Pro 1.5') {
          try {
            const geminiResponse = await callGeminiPro(newMessage.content, selectedImage);
            const aiMessage: Message = { role: 'ai', content: geminiResponse, type: 'text' };
            setMessages(prev => [...prev, aiMessage]);
            await saveConversation(userId, toolName, [aiMessage]);
          } catch (error) {
            console.error('Error calling Gemini Pro 1.5:', error);
            let errorMessage = 'An error occurred. Please try again later.';
            if (error instanceof Error && error.message.includes('RESOURCE_EXHAUSTED')) {
              errorMessage = 'The AI service is currently busy. Please try again in a few minutes.';
            }
            const errorAiMessage: Message = { 
              role: 'ai', 
              content: errorMessage, 
              type: 'text' 
            };
            setMessages(prev => [...prev, errorAiMessage]);
          }

        } else if (toolName === 'Perplexity') {
          const formattedMessages = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          }));

          formattedMessages.push({ role: 'user', content: input });

          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: formattedMessages,
              temperature: 0.2,
              max_tokens: 4000,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Perplexity API error:', errorData);
            throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
          }

          const data = await response.json();
          if (data.choices && data.choices[0] && data.choices[0].message) {
            const aiMessage: Message = { role: 'ai', content: data.choices[0].message.content, type: 'text' };
            setMessages(prev => [...prev, aiMessage]);
            await saveConversation(userId, toolName, [aiMessage]);
          } else {
            throw new Error('Unexpected response format from Perplexity API');
          }
        } else if (toolName === 'Groq') {
          try {
            const groqResponse = await callGroq(newMessage.content);
            const aiMessage: Message = { role: 'ai', content: groqResponse, type: 'text' };
            setMessages(prev => [...prev, aiMessage]);
            await saveConversation(userId, toolName, [aiMessage]);
          } catch (error) {
            console.error('Error calling Groq:', error);
            const errorAiMessage: Message = { 
              role: 'ai', 
              content: 'An error occurred while processing your request with Groq. Please try again later.', 
              type: 'text' 
            };
            setMessages(prev => [...prev, errorAiMessage]);
          }
        } else if (isImageTool) {
          const enhancedPrompt = generateCategoryPrompt(input, category);
          const response = await fetch(IMAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: enhancedPrompt, 
              firebaseUserId: user?.uid,
              numSteps: numSteps,
              aspectRatio: aspectRatio,
              category: category
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${data.error}, details: ${data.details}`);
          }

          if (data.image) {
            const imageUrl = `data:image/png;base64,${data.image}`;
            const croppedImageUrl = await cropImage(imageUrl, aspectRatio);
            const aiMessage: Message = { role: 'ai', content: croppedImageUrl, type: 'image' };
            setMessages(prev => [...prev, aiMessage]);
            
            // Save the AI's response
            try {
              await saveConversation(userId, toolName, [aiMessage]);
            } catch (error) {
              console.error('Failed to save AI image response:', error);
            }
          } else {
            throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
          }
        } else {
          const response = await fetch(TEXT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
              })),
              firebaseUserId: user?.uid,
              toolName: toolName,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          if (data.response) {
            const aiMessage: Message = { role: 'ai', content: data.response, type: 'text' };
            setMessages(prev => [...prev, aiMessage]);
            
            // Save the AI's response
            try {
              await saveConversation(userId, toolName, [aiMessage]);
            } catch (error) {
              console.error('Failed to save AI text response:', error);
            }
          } else {
            throw new Error('Unexpected response format');
          }
        }

        if (response) {
          const aiMessage: Message = { role: 'ai', content: response.response, type: 'text' };
          setMessages(prev => [...prev, aiMessage]);
          await saveConversation(userId, toolName, [aiMessage]);
        }
      } catch (error) {
        console.error('Error:', error);
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'text' 
        }]);
      }

      setIsLoading(false);
      setSelectedImage(null);
    }
  };

  const downloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${aspectRatio.replace(':', 'x')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You can add a toast notification here if you want to inform the user that the text has been copied
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const renderMessage = (message: Message, index: number) => {
    if (message.type === 'image') {
      return (
        <div className="flex flex-col items-center gap-2">
          <img 
            src={message.imageUrl || message.content} 
            alt={message.role === 'user' ? "Uploaded image" : "Generated image"}
            className="max-w-full h-auto rounded cursor-pointer transition-transform duration-300 hover:scale-105" 
            style={{ 
              maxWidth: '512px',
              maxHeight: '512px',
              objectFit: 'contain' 
            }}
            onClick={() => window.open(message.imageUrl || message.content, '_blank')}
          />
          {message.role === 'ai' && (
            <Button
              onClick={() => downloadImage(message.imageUrl || message.content)}
              variant="outline"
              size="sm"
              className="w-full mt-2 bg-gray-700 hover:bg-gray-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Image
            </Button>
          )}
        </div>
      )
    } else {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const contentWithLinks = message.content.replace(urlRegex, (url) => 
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${url}</a>`
      );

      return (
        <div className="relative group">
          {message.role === 'ai' && (
            <button
              onClick={() => copyToClipboard(message.content)}
              className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white transition-colors duration-200 bg-gray-800 rounded opacity-0 group-hover:opacity-100"
              aria-label="Copy response"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>
          )}
          <div className="prose prose-invert max-w-none break-words">
            <ReactMarkdown
              components={{
                code: ({node, inline, className, children, ...props}) => {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md overflow-hidden mb-2 mt-2"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-gray-800 rounded px-1 py-0.5" {...props}>
                      {children}
                    </code>
                  )
                },
                a: ({node, ...props}) => (
                  <a 
                    className="text-blue-400 hover:underline" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    {...props} 
                  />
                ),
              }}
              rehypePlugins={[rehypeRaw as Plugin]}
            >
              {contentWithLinks}
            </ReactMarkdown>
          </div>
        </div>
      )
    }
  }

  const generateSummary = (messages: { role: 'user' | 'ai'; content: string; type: 'text' | 'image' }[]): string => {
    const userMessages = messages.filter(m => m.role === 'user');
    const firstUserMessage = userMessages[0]?.content || '';
    return firstUserMessage.split(' ').slice(0, 5).join(' ') + '...';
  }

  // const getModelForTool = (toolName: string): string => {
  //   switch (toolName) {
  //     case 'C':
  //       return 'openai/gpt-3.5-turbo';
  //     case 'Claude':
  //       return 'anthropic/claude-2';
  //     case 'GPT-4':
  //       return 'openai/gpt-4';
  //     case 'Copilot':
  //       return 'openai/gpt-4'; // Assuming Copilot uses GPT-4
  //     case 'Whisper':
  //       return 'openai/whisper'; // Note: Whisper might require a different API endpoint for audio processing
  //     case 'Runway':
  //       return 'openai/gpt-4'; // Assuming Runway uses GPT-4, but it might require a different API for video editing
  //     default:
  //       return 'openai/gpt-3.5-turbo';
  //   }
  // };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 1024; // Maximum size for width or height
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          } else if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          const resizedImage = canvas.toDataURL('image/jpeg', 0.7);
          setSelectedImage(resizedImage);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const callGeminiPro = async (prompt: string, imageUrl: string | null, retryCount = 0): Promise<string> => {
    const messages = [{
      role: "user",
      content: imageUrl ? [
        {
          type: "text",
          text: prompt
        },
        {
          type: "text",
          text: imageUrl
        }
      ] : [
        {
          type: "text",
          text: prompt
        }
      ]
    }];

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": `${window.location.origin}`,
          "X-Title": "Every AI",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-pro-1.5-exp",
          messages: messages
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        if (response.status === 429 && retryCount < 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
          console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return callGeminiPro(prompt, imageUrl, retryCount + 1);
        }
        throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Gemini Pro API response:', data);

      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return data.choices[0].message.content;
      } else if (data.error) {
        throw new Error(`API Error: ${JSON.stringify(data.error)}`);
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('Unexpected response format from Gemini Pro API');
      }
    } catch (error) {
      console.error('Error calling Gemini Pro API:', error);
      throw error;
    }
  };

  const callGroq = async (prompt: string): Promise<string> => {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "llama-3.2-11b-vision-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 1,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Groq API error: ${response.status} ${response.statusText}, ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "No response from Groq";
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  };

  const generateInitialPrompt = (topic: string, keywords: string, audience: string, tone: string) => {
    return `Generate a detailed blog outline about "${topic}". 
    Keywords to include: ${keywords}. 
    Target audience: ${audience}. 
    Tone: ${tone}. 
    Please provide a structured outline with introduction, main points, and conclusion.
    The response should be detailed and well-researched.`;
  };

  const generateFinalBlogPrompt = (outline: string) => {
    return `Using this outline: ${outline}

    Create a comprehensive blog post that is at least 3000 words. The blog should:
    1. Have a compelling introduction that hooks the reader
    2. Include well-researched main points with examples and data
    3. Have smooth transitions between sections
    4. Include relevant statistics and expert quotes where applicable
    5. End with a strong conclusion that summarizes key points
    6. Use proper formatting with headers, subheaders, and paragraphs
    7. Include references or citations where applicable
    8. Make it less than grade 8 english

    Format the response in markdown with proper headings (##) and sections.`;
  };

  const generateBlog = async () => {
    if (!blogTopic.trim()) return;
    
    setIsLoading(true);
    try {
      // First API call to get the outline
      const outlinePrompt = generateInitialPrompt(blogTopic, keywords, targetAudience, tone);
      const outlineResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: outlinePrompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!outlineResponse.ok) {
        throw new Error(`Outline API error: ${outlineResponse.status}`);
      }

      const outlineData = await outlineResponse.json();
      console.log('Outline Response:', outlineData);
      
      const outline = outlineData.choices[0].message.content;

      // Second API call to generate the full blog
      const blogResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=AIzaSyDNp-gscV7HSPlV7WyKNtdYP2b7KQyle_w`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: generateFinalBlogPrompt(outline)
            }]
          }]
        })
      });

      if (!blogResponse.ok) {
        throw new Error(`Blog API error: ${blogResponse.status}`);
      }

      const blogData = await blogResponse.json();
      console.log('Blog Response:', blogData);
      
      const blogContent = blogData.candidates[0].content.parts[0].text;

      // Add the blog to messages
      const newMessage: Message = {
        role: 'ai',
        content: blogContent,
        type: 'text'
      };

      setMessages(prev => [...prev, newMessage]);
      await saveConversation(userId, toolName, [newMessage]);

    } catch (error) {
      console.error('Error generating blog:', error);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Error generating blog post: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        type: 'text'
      }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <header className="bg-gray-800 p-4 flex items-center shadow-md">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-4">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{toolName}</h1>
      </header>
      
      {isImageTool && showNote && (
        <div className="bg-blue-900 text-white p-4 text-sm relative">
          <p>Note: The image generation model supports square images (1:1 aspect ratio). 
          The aspect ratio selection affects the cropping of the generated image for display and download, 
          but the initial generation is always square.</p>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 text-white hover:bg-blue-800"
            onClick={() => setShowNote(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-grow p-6" ref={scrollAreaRef}>
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div className={`flex items-start max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-blue-500 ml-2' : 'bg-purple-500 mr-2'}`}>
                  {message.role === 'user' ? <User className="w-5 h-5 text-white" /> : <MessageCircle className="w-5 h-5 text-white" />}
                </div>
                <div className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {renderMessage(message, index)}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>
      <div className="p-4 bg-gray-800 border-t border-gray-700 relative">
        <AnimatePresence>
          {isLoading && (
            <RobotThinking />
          )}
        </AnimatePresence>
        <div className="flex space-x-2">
          {toolName === 'Blog Generator' ? (
            <div className="space-y-4 mb-4 w-full">
              <Input
                placeholder="Enter blog topic"
                value={blogTopic}
                onChange={(e) => setBlogTopic(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
              />
              <Input
                placeholder="Enter keywords (comma-separated)"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
              />
              <Input
                placeholder="Target audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
              />
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="w-full bg-gray-700 text-white border-gray-600">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 text-white border-gray-600">
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={generateBlog}
                disabled={isLoading || !blogTopic.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? <Loader className="h-5 w-5 animate-spin" /> : 'Generate Blog'}
              </Button>
            </div>
          ) : (
            <>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isImageTool ? "Describe the image you want to generate..." : "Type your message..."}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                className="flex-grow bg-gray-700 text-white border-gray-600 focus:border-blue-500 transition-colors duration-300"
                disabled={isLoading}
              />
              {isTextTool && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isImageTool && (
                <>
                  <Tooltip content="Number of diffusion steps">
                    <Input
                      type="number"
                      value={numSteps}
                      onChange={(e) => setNumSteps(Math.min(Math.max(1, parseInt(e.target.value)), 8))}
                      className="w-20 bg-gray-700 text-white border-gray-600 focus:border-blue-500 transition-colors duration-300"
                      min="1"
                      max="8"
                    />
                  </Tooltip>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="w-[120px] bg-gray-700 text-white border-gray-600 focus:border-blue-500">
                      <SelectValue placeholder="Aspect Ratio" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 text-white border-gray-600">
                      <SelectItem value="1:1" className="text-white hover:bg-gray-600">1:1 (Square)</SelectItem>
                      <SelectItem value="9:16" className="text-white hover:bg-gray-600">9:16 (Portrait)</SelectItem>
                      <SelectItem value="16:9" className="text-white hover:bg-gray-600">16:9 (Landscape)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-[120px] bg-gray-700 text-white border-gray-600 focus:border-blue-500">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 text-white border-gray-600">
                      <SelectItem value="realistic" className="text-white hover:bg-gray-600">Realistic</SelectItem>
                      <SelectItem value="cartoon" className="text-white hover:bg-gray-600">Cartoon</SelectItem>
                      <SelectItem value="anime" className="text-white hover:bg-gray-600">Anime</SelectItem>
                      <SelectItem value="painting" className="text-white hover:bg-gray-600">Painting</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button 
                onClick={sendMessage} 
                disabled={isLoading} 
                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-300"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : isImageTool ? (
                  <ImageIcon className="h-5 w-5" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      {selectedImage && (
        <div className="mt-2 flex justify-center">
          <img src={selectedImage} alt="Selected" className="max-w-xs max-h-32 object-contain rounded" />
        </div>
      )}
    </div>
  )
}

export default ToolInterface
//commit is here
//now 
//comitted