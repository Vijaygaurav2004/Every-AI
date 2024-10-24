import React, { useState } from 'react'
import { X, Maximize2, Minimize2, Send, Image as ImageIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'

interface ChatInterfaceProps {
  toolName: string
  onClose: () => void
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ toolName, onClose }) => {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; type: 'text' | 'image' }[]>([])
  const [input, setInput] = useState('')

  const isImageTool = toolName === 'Flux' || toolName === 'Stable Diffusion'

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen)
  }

  const sendMessage = () => {
    if (input.trim()) {
      setMessages([...messages, { role: 'user', content: input, type: 'text' }])
      setTimeout(() => {
        if (isImageTool) {
          setMessages(prev => [...prev, { role: 'ai', content: 'https://via.placeholder.com/300', type: 'image' }])
        } else {
          setMessages(prev => [...prev, { role: 'ai', content: `Response from ${toolName}`, type: 'text' }])
        }
      }, 1000)
      setInput('')
    }
  }

  return (
    <div className={`bg-gray-800 text-white rounded-lg overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      <div className="flex justify-between items-center p-4 bg-gray-700">
        <h2 className="text-xl font-bold">{toolName}</h2>
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" onClick={toggleFullScreen}>
            {isFullScreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[calc(100%-8rem)]">
        <div className="p-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                {message.type === 'text' ? (
                  message.content
                ) : (
                  <img src={message.content} alt="Generated image" className="max-w-full h-auto rounded" />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 bg-gray-700">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isImageTool ? "Describe the image you want to generate..." : "Type your message..."}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <Button onClick={sendMessage}>
            {isImageTool ? <ImageIcon className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface