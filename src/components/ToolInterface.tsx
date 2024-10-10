import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Send, Image as ImageIcon, ArrowLeft, Download, User, MessageCircle, Loader } from 'lucide-react'
import { TEXT_API_URL, IMAGE_API_URL } from '../config'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '../firebase'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip } from './ui/tooltip'
import RobotThinking from './RobotThinking'

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
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isImageTool = toolName === 'DALL-E' || toolName === 'Stable Diffusion'

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [messages])

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
            body: JSON.stringify({ prompt: input, num_steps: numSteps, userId: user.uid }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}, details: ${errorData.details}`);
          }

          const data = await response.json();
          if (data.image) {
            const imageUrl = `data:image/png;base64,${data.image}`;
            setMessages(prev => [...prev, { role: 'ai', content: imageUrl, type: 'image' }]);
          } else {
            throw new Error('Unexpected response format: no image data');
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
    link.download = 'generated-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMessage = (message: { role: 'user' | 'ai'; content: string; type: 'text' | 'image' }) => {
    if (message.type === 'image') {
      return (
        <div className="flex flex-col items-center">
          <img 
            src={message.content} 
            alt="Generated image" 
            className="max-w-full h-auto rounded cursor-pointer transition-transform duration-300 hover:scale-105" 
            style={{ maxHeight: '300px', objectFit: 'contain' }}
            onClick={() => window.open(message.content, '_blank')}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => downloadImage(message.content)}
          >
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
        </div>
      )
    } else {
      return (
        <ReactMarkdown
          className="prose prose-invert max-w-none"
          components={{
            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-3 mb-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-2 mb-1" {...props} />,
            p: ({node, ...props}) => <p className="mb-2" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '')
              return !inline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-md overflow-hidden mb-2"
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
                  {renderMessage(message)}
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