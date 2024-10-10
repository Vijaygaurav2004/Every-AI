import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Send, Image as ImageIcon, ArrowLeft, Download, User, MessageCircle, Loader, Copy, Check, X } from 'lucide-react'
import { TEXT_API_URL, IMAGE_API_URL } from '../config'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '../firebase'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip } from './ui/tooltip'
import RobotThinking from './RobotThinking'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

// Note: The image generation models currently support only square images (1:1 aspect ratio).
// The aspect ratio selection affects the cropping of the generated image for display and download,
// but the initial generation is always square.

interface ToolInterfaceProps {
  toolName: string
  onBack: () => void
  userId: string
}

const ToolInterface: React.FC<ToolInterfaceProps> = ({ toolName, onBack }) => {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; type: 'text' | 'image' }[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [numSteps, setNumSteps] = useState(4)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [showNote, setShowNote] = useState(true)

  const isImageTool = toolName === 'DALL-E' || toolName === 'Stable Diffusion'

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [messages])

  const copyToClipboard = (text: string, blockId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, [blockId]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [blockId]: false }))
      }, 2000)
    })
  }

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
    if (input.trim() && user) {
      const newMessage = { role: 'user' as const, content: input, type: 'text' as const };
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      setIsLoading(true);

      try {
        if (isImageTool) {
          const response = await fetch(IMAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: input, 
              userId: user.uid,
              numSteps: numSteps,
              aspectRatio: aspectRatio
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${data.error}, details: ${data.details}`);
          }

          if (data.image) {
            const imageUrl = `data:image/png;base64,${data.image}`;
            const croppedImageUrl = await cropImage(imageUrl, aspectRatio);
            setMessages(prev => [...prev, { role: 'ai', content: croppedImageUrl, type: 'image' }]);
          } else {
            throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
          }
        } else {
          const response = await fetch(TEXT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [...messages, newMessage].map(msg => ({
                role: msg.role,
                content: msg.content,
              })),
              userId: user.uid,
              toolName: toolName,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          if (data.response) {
            setMessages(prev => [...prev, { role: 'ai', content: data.response, type: 'text' }]);
          } else {
            throw new Error('Unexpected response format');
          }
        }
      } catch (error) {
        console.error('Error:', error);
        setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error instanceof Error ? error.message : String(error)}`, type: 'text' }]);
      } finally {
        setIsLoading(false);
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

  const renderMessage = (message: { role: 'user' | 'ai'; content: string; type: 'text' | 'image' }, index: number) => {
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
      return (
        <ReactMarkdown
          className="prose prose-invert max-w-none break-words"
          components={{
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '')
              const blockId = `code-block-${index}`
              return !inline && match ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700"
                    onClick={() => copyToClipboard(String(children), blockId)}
                  >
                    {copiedStates[blockId] ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md overflow-hidden mb-2 mt-2"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className="bg-gray-800 rounded px-1 py-0.5" {...props}>
                  {children}
                </code>
              )
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
      )
    }
  }

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
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isImageTool ? "Describe the image you want to generate..." : "Type your message..."}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
            className="flex-grow bg-gray-700 text-white border-gray-600 focus:border-blue-500 transition-colors duration-300"
            disabled={isLoading}
          />
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
        </div>
      </div>
    </div>
  )
}

export default ToolInterface