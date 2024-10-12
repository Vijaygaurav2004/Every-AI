import { HISTORY_API_URL } from '../config';

export const saveConversation = async (userId: string, tool: string, messages: any[], summary: string) => {
  try {
    console.log('Saving conversation:', { userId, tool, messages, summary });
    const response = await fetch(`${HISTORY_API_URL}/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        tool,
        messages,
        summary,
        timestamp: Date.now(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${result.error}, details: ${result.details}`);
    }

    console.log('Conversation saved successfully:', result);
    return result;
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

export const deleteConversation = async (id: string) => {
  try {
    console.log('Deleting conversation:', id);
    const response = await fetch(`${HISTORY_API_URL}/history`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${data.error}, details: ${data.details}`);
    }

    console.log('Conversation deleted successfully');
    return data;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};
