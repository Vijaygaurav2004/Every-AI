import { HISTORY_API_URL } from '../config';

export const saveConversation = async (userId: string, tool: string, messages: Message[]) => {
  try {
    console.log('Saving message:', { userId, tool, messages });
    const response = await fetch(`${HISTORY_API_URL}/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        tool,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          type: m.type,
          sources: m.sources
        })),
        timestamp: Date.now(),
      }),
    });

    const responseData = await response.json();
    console.log('Response from server:', responseData);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.error}, details: ${responseData.details}`);
    }

    console.log('Message saved successfully:', responseData);
    return responseData;
  } catch (error) {
    console.error('Error saving message:', error);
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
