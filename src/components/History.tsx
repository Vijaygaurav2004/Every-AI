import React, { useEffect, useState, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { HISTORY_API_URL } from '../config';
import { Button } from './ui/button';
import { Trash } from 'lucide-react';
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
  summary: string;
  timestamp: number;
}

const History: React.FC = () => {
  const [user] = useAuthState(auth);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user || fetchedRef.current) return;
      fetchedRef.current = true;

      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching history from:', `${HISTORY_API_URL}/history?firebaseUserId=${user.uid}`);
        const response = await fetch(`${HISTORY_API_URL}/history?firebaseUserId=${user.uid}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}, details: ${errorData.details}`);
        }
        const data = await response.json();
        console.log('Received history data:', data);
        
        if (!data.results || !Array.isArray(data.results)) {
          throw new Error('Invalid data format received from server');
        }

        console.log('Number of history items:', data.results.length);
        setHistory(data.results.sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp));
      } catch (error) {
        console.error('Error fetching history:', error);
        setError(`Failed to fetch history: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const handleDelete = async (itemId: string) => {
    try {
      console.log('Deleting conversation with id:', itemId);
      await deleteConversation(itemId);
      setHistory(prevHistory => prevHistory.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setError(`Failed to delete conversation: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (isLoading) return <div>Loading history...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-white">
      <h2 className="text-2xl font-bold mb-4">History</h2>
      {history.length === 0 ? (
        <p>No history available.</p>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          {history.map((item) => (
            <div key={item.id} className="mb-6 p-4 bg-gray-700 rounded relative">
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleDelete(item.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
              <h3 className="font-bold text-lg mb-2">{item.tool}</h3>
              <p className="text-sm mb-2">{item.summary}</p>
              <div className="space-y-2">
                {item.messages.map((message, index) => (
                  <div key={`${item.id}-message-${index}`} className={`p-2 rounded ${message.role === 'user' ? 'bg-blue-900' : 'bg-green-900'}`}>
                    <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
                    {message.type === 'text' ? (
                      message.content
                    ) : (
                      <img src={message.content} alt="Generated image" className="max-w-full h-auto mt-2" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">{new Date(item.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
};

export default History;
