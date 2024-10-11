import React, { useEffect, useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { HISTORY_API_URL } from '../config';

interface HistoryItem {
  id: number;
  tool_name: string;
  prompt: string;
  response_type: 'text' | 'image';
  response: string;
  created_at: string;
}

const History: React.FC = () => {
  const [user, userLoading] = useAuthState(auth);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching history from:', `${HISTORY_API_URL}?firebaseUserId=${user.uid}`);
        const response = await fetch(`${HISTORY_API_URL}?firebaseUserId=${user.uid}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}, details: ${errorData.details}`);
        }
        const data = await response.json();
        console.log('Received history data:', data);
        if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
          setHistory(data.results);
        } else {
          throw new Error('Unexpected response format');
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        setError(`Failed to fetch history: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (!userLoading) {
      fetchHistory();
    }
  }, [user, userLoading]);

  if (userLoading) {
    return <div className="text-white">Loading user...</div>;
  }

  if (!user) {
    return <div className="text-white">Please log in to view history.</div>;
  }

  if (isLoading) {
    return <div className="text-white">Loading history...</div>;
  }

  if (error) {
    return <div className="text-white">Error: {error}</div>;
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-white">
      <h2 className="text-2xl font-bold mb-4">History</h2>
      <ScrollArea className="h-[calc(100vh-200px)]">
        {history.length === 0 ? (
          <p>No history available.</p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="mb-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-bold">{item.tool_name}</h3>
              <p className="text-sm text-gray-300">Prompt: {item.prompt}</p>
              {item.response_type === 'text' ? (
                <p className="text-sm mt-2">Response: {item.response.substring(0, 100)}...</p>
              ) : (
                <img src={`data:image/png;base64,${item.response}`} alt="Generated image" className="mt-2 max-w-full h-auto" />
              )}
              <p className="text-xs text-gray-400 mt-2">{new Date(item.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
};

export default History;