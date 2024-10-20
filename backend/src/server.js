const express = require('express');
const app = express();

// Existing imports...
import { generateText } from './textGeneratorWorker';

// ... (existing code)

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    const { content, sources } = await generateText(prompt);
    res.json({ message: content, sources });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'An error occurred while generating the response.' });
  }
});

// ... (rest of the server code)
