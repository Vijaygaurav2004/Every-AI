import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Send, Image as ImageIcon, ArrowLeft, Download, User, MessageCircle, Loader, X, Copy, CheckCircle } from 'lucide-react'
import { TEXT_API_URL, IMAGE_API_URL, HISTORY_API_URL, PERPLEXITY_API_KEY } from '../config'
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
import rehypeRaw from 'rehype-raw'


interface ToolInterfaceProps {
  toolName: string
  onBack: () => void
  userId: string
}

interface Source {
  title: string;
  url: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  type: 'text' | 'image';
  sources?: Source[];
}

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

  const isImageTool = toolName === 'DALL-E' || toolName === 'Stable Diffusion'

  const [category, setCategory] = useState('realistic')

  const [isFocused, setIsFocused] = useState(false)

  const [sources, setSources] = useState<{ title: string, url: string }[]>([]);

  const [focusMode, setFocusMode] = useState('default')

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const extractSources = (content: string): Source[] => {
    const sourceRegex = /\[(\d+)\]\s+(.*?):\s+(https?:\/\/\S+)/g;
    const sources: Source[] = [];
    let match;

    while ((match = sourceRegex.exec(content)) !== null) {
      sources.push({
        title: match[2],
        url: match[3]
      });
    }

    return sources;
  };

  const sendMessage = async () => {
    if (input.trim()) {
      const newMessage: Message = { role: 'user', content: input, type: 'text' };
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      setIsLoading(true);

      try {
        await saveConversation(userId, toolName, [newMessage]);

        if (toolName === 'Perplexity') {
          const formattedMessages = [
            ...messages.map(m => ({
              role: m.role === 'ai' ? 'assistant' : 'user',
              content: m.content
            })),
            { role: 'user', content: input }
          ];

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
              return_citations: true
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
          }

          const data = await response.json();
          const aiContent = data.choices[0].message.content;
          
          // Extract sources from the response
          const sources = extractSources(aiContent);

          // Remove source information from the content
          const cleanContent = aiContent.replace(/\[\d+\].*?(?=(\[\d+\]|$))/gs, '').trim();

          const aiMessage: Message = { 
            role: 'ai', 
            content: cleanContent, 
            type: 'text',
            sources: sources
          };
          setMessages(prev => [...prev, aiMessage]);

          try {
            await saveConversation(userId, toolName, [aiMessage]);
          } catch (error) {
            console.error('Failed to save AI response:', error);
          }
        } else if (isImageTool) {
          const response = await fetch(IMAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: input, 
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
          if (data.choices && data.choices.length > 0) {
            const aiMessage: Message = {
              role: 'ai',
              content: data.choices[0].message.content,
              type: 'text',
              sources: extractSources(data.choices[0].message.content)
            };
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
      } catch (error) {
        console.error('Error:', error);
        const errorMessage: Message = { 
          role: 'ai', 
          content: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'text' 
        };
        setMessages(prev => [...prev, errorMessage]);
        
        // Save the error message
        try {
          await saveConversation(userId, toolName, [errorMessage]);
        } catch (saveError) {
          console.error('Failed to save error message:', saveError);
        }
      } finally {
        setIsLoading(false);
        setIsFocused(false);
      }
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

  const formatLinks = (content: string) => {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(linkRegex, (match) => {
      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${match}</a>`;
    });
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const Sources: React.FC<{ sources: Source[] }> = ({ sources }) => {
    if (!sources || sources.length === 0) return null;
    
    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-colors duration-300 flex items-center space-x-2 overflow-hidden"
          >
            <span className="text-blue-400 text-xs sm:text-sm truncate">{source.title}</span>
          </a>
        ))}
      </div>
    );
  };

  const renderMessage = (message: Message, index: number) => {
    if (message.type === 'image') {
      return (
        <div className="flex flex-col items-center">
          <img 
            src={message.content} 
            alt="Generated image" 
            className="max-w-full h-auto rounded cursor-pointer transition-transform duration-300 hover:scale-105" 
            style={{ 
              maxWidth: '512px',
              maxHeight: '512px',
              objectFit: 'contain' 
            }}
            onClick={() => window.open(message.content, '_blank')}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => downloadImage(message.content)}
          >
            <Download className="h-4 w-4 mr-2" /> Download ({aspectRatio})
          </Button>
        </div>
      )
    } else {
      const formattedContent = message.role === 'ai' ? formatLinks(message.content) : message.content;
      return (
        <div className={`p-4 rounded-lg ${message.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'} relative`}>
          {message.role === 'ai' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              onClick={() => copyToClipboard(message.content, index)}
            >
              {copiedIndex === index ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            className="prose prose-invert max-w-none break-words text-sm sm:text-base"
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
                  {...props} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(props.href, '_blank', 'noopener,noreferrer');
                  }}
                />
              )
            }}
          >
            {formattedContent}
          </ReactMarkdown>
          {message.role === 'ai' && message.sources && message.sources.length > 0 && (
            <Sources sources={message.sources} />
          )}
        </div>
      )
    }
  }

  const generateSummary = (messages: { role: 'user' | 'ai'; content: string; type: 'text' | 'image' }[]): string => {
    const userMessages = messages.filter(m => m.role === 'user');
    const firstUserMessage = userMessages[0]?.content || '';
    return firstUserMessage.split(' ').slice(0, 5).join(' ') + '...';
  }

  const handleFocus = () => {
    setIsFocused(true);
    sendMessage(true);
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

      <ScrollArea className="flex-grow p-2 sm:p-4 md:p-6" ref={scrollAreaRef}>
        <AnimatePresence>
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
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
                    }
                  }}
                  rehypePlugins={[rehypeRaw]}
                >
                  {message.content}
                </ReactMarkdown>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-semibold">Sources:</h4>
                    <ul className="list-disc list-inside">
                      {message.sources.map((source, sourceIndex) => (
                        <li key={sourceIndex} className="text-xs">
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </AnimatePresence>
      </ScrollArea>
      <div className="p-2 sm:p-4 bg-gray-800 border-t border-gray-700 relative">
        <AnimatePresence>
          {isLoading && (
            <RobotThinking />
          )}
        </AnimatePresence>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isImageTool ? "Describe the image you want to generate..." : "Type your message..."}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
            className="flex-grow bg-gray-700 text-white border-gray-600 focus:border-blue-500 transition-colors duration-300"
            disabled={isLoading}
          />
          {toolName === 'Perplexity' && (
            <Select value={focusMode} onValueChange={setFocusMode}>
              <SelectTrigger className="w-full sm:w-[150px] bg-gray-700 text-white border-gray-600 focus:border-blue-500">
                <SelectValue placeholder="Focus Mode" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 text-white border-gray-600">
                <SelectItem value="default" className="text-white hover:bg-gray-600">Default</SelectItem>
                <SelectItem value="academic" className="text-white hover:bg-gray-600">Academic</SelectItem>
                <SelectItem value="math" className="text-white hover:bg-gray-600">Math</SelectItem>
                <SelectItem value="writing" className="text-white hover:bg-gray-600">Writing</SelectItem>
                <SelectItem value="video" className="text-white hover:bg-gray-600">Video</SelectItem>
                <SelectItem value="social" className="text-white hover:bg-gray-600">Social</SelectItem>
                <SelectItem value="reasoning" className="text-white hover:bg-gray-600">Reasoning</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button 
            onClick={sendMessage}
            disabled={isLoading} 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-300"
          >
            {isLoading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : isImageTool ? (
              <ImageIcon className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ToolInterface