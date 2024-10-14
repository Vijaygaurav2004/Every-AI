import React, { useEffect, useState, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { HISTORY_API_URL } from '../config';
import { Button } from './ui/button';
import { Trash, MessageSquare, Image as ImageIcon, Download } from 'lucide-react';
import { deleteConversation } from '../utils/historyUtils';

interface Message {
  role: 'user' | 'ai';
  content: string;
  type: 'text' | 'image';
}

interface HistoryItem {
  id: string;
  userId: string;
  tool: string;
  messages: Message[];
  timestamp: number;
}

const History: React.FC = () => {
  const [user] = useAuthState(auth);
  const [history, setHistory] = useState<{ text: HistoryItem[], image: HistoryItem[] }>({ text: [], image: [] });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const fetchedRef = useRef(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || fetchedRef.current) return;
      fetchedRef.current = true;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${HISTORY_API_URL}/history?firebaseUserId=${user.uid}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}, details: ${errorData.details}`);
        }
        const data = await response.json();
        setHistory(data);
      } catch (error) {
        console.error('Error fetching history:', error);
        setError(`Failed to fetch history: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const handleDelete = async (itemId: string, isTextHistory: boolean) => {
    try {
      await deleteConversation(itemId);
      setHistory(prev => ({
        ...prev,
        [isTextHistory ? 'text' : 'image']: prev[isTextHistory ? 'text' : 'image'].filter(item => item.id !== itemId)
      }));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setError(`Failed to delete conversation: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const downloadImage = (imageUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <div className="text-center py-8">Loading history...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error: {error}</div>;

  const renderHistory = (historyItems: HistoryItem[], isTextHistory: boolean) => (
    <ScrollArea className="h-[calc(100vh-200px)]">
      {historyItems.map((item) => (
        <div key={item.id} className="mb-6 p-4 bg-gray-700 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">{item.tool}</h3>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(item.id, isTextHistory)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-400 mb-2">{new Date(item.timestamp).toLocaleString()}</p>
          <div className="space-y-2">
            {item.messages.map((message, index) => (
              <div key={`${item.id}-message-${index}`} className={`p-2 rounded ${message.role === 'user' ? 'bg-blue-900' : 'bg-green-900'}`}>
                <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
                {message.type === 'text' ? (
                  message.content
                ) : (
                  <div className="mt-2">
                    <img 
                      src={message.content} 
                      alt="Generated image" 
                      className="max-w-full h-auto rounded-md"
                      style={{ maxHeight: '200px', objectFit: 'contain' }}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="mt-2"
                      onClick={() => downloadImage(message.content, `generated-image-${item.timestamp}.png`)}
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </ScrollArea>
  );

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">Conversation History</h2>
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-l-lg ${activeTab === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            onClick={() => setActiveTab('text')}
          >
            <MessageSquare className="inline-block mr-2 h-4 w-4" />
            Text Models
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-r-lg ${activeTab === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            onClick={() => setActiveTab('image')}
          >
            <ImageIcon className="inline-block mr-2 h-4 w-4" />
            Image Models
          </button>
        </div>
      </div>
      {renderHistory(history[activeTab], activeTab === 'text')}
    </div>
  );
};

export default History;
