const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: [
    'https://neurodivergent-communication-bridge-5pfw.onrender.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const sessions = new Map();

// Emotion detection function using direct API call
async function analyzeEmotion(text) {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: text })
    });
    
    if (!response.ok) {
      console.error('Emotion API error:', await response.text());
      return null;
    }
    
    const result = await response.json();
    return result[0]; // Returns array of emotions
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return null;
  }
}

// Detect sarcasm using direct API call
async function detectSarcasm(text) {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/mrm8488/t5-base-finetuned-sarcasm-twitter', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: text })
    });
    
    if (!response.ok) {
      console.error('Sarcasm API error:', await response.text());
      return null;
    }
    
    const result = await response.json();
    return result[0];
  } catch (error) {
    console.error('Sarcasm detection error:', error);
    return null;
  }
}

// Helper functions
function formatEmotionFeedback(emotions) {
  if (!emotions || emotions.length === 0) return null;
  
  const topEmotion = emotions[0];
  const emotionEmojis = {
    joy: '😊',
    sadness: '😢',
    anger: '😠',
    fear: '😰',
    surprise: '😮',
    neutral: '😐'
  };
  
  return {
    emotion: topEmotion.label,
    confidence: (topEmotion.score * 100).toFixed(0) + '%',
    emoji: emotionEmojis[topEmotion.label] || '🙂',
    message: `Your tone seems ${topEmotion.label}`
  };
}

function generatePersonalizedHints(emotion, baseHints, isSarcastic) {
  const hints = [...baseHints];
  
  if (emotion && emotion.length > 0) {
    const topEmotion = emotion[0].label;
    
    if (topEmotion === 'anger' || topEmotion === 'fear') {
      hints.push("💙 Take a deep breath. It's okay to pause before responding.");
    }
    if (topEmotion === 'sadness') {
      hints.push("💚 You're doing great. Remember this is practice in a safe space.");
    }
  }
  
  if (isSarcastic) {
    hints.push("🔍 The other person may be using indirect language. Look for hidden meanings.");
  }
  
  return hints;
}

const scenarioConfigs = {
  workplace_meeting: {
    character: 'Alex, your team lead',
    context: 'You are in a weekly team standup meeting. The team lead wants to hear updates on your project progress.',
    personality: 'professional, encouraging, slightly busy',
    socialCues: ['active listening', 'time awareness', 'turn-taking']
  },
  job_interview: {
    character: 'Sarah, the hiring manager',
    context: 'You are interviewing for a software engineer position. The interviewer wants to understand your technical skills and cultural fit.',
    personality: 'formal, evaluative, detailed-oriented',
    socialCues: ['confidence assessment', 'competency evaluation', 'professional demeanor']
  },
  casual_chat: {
    character: 'Jamie, a friend you met at a coffee shop',
    context: 'You are having a casual conversation over coffee. Your friend is interested in catching up and learning about your life.',
    personality: 'friendly, relaxed, curious',
    socialCues: ['reciprocal sharing', 'emotional attunement', 'humor appreciation']
  },
  conflict_resolution: {
    character: 'Taylor, your colleague',
    context: 'There has been a disagreement about project responsibilities. Taylor seems frustrated and wants to discuss the situation.',
    personality: 'initially defensive, emotionally expressive, seeking resolution',
    socialCues: ['emotional regulation', 'active listening', 'empathy', 'compromise']
  },
  class_presentation: {
    character: 'Dr. Martinez, your professor',
    context: 'You just finished presenting your research. Dr. Martinez and classmates have questions about your methodology and findings.',
    personality: 'inquisitive, academic, constructively critical',
    socialCues: ['knowledge demonstration', 'handling criticism', 'clarity in explanation']
  },
  study_group: {
    character: 'Chris, a study group member',
    context: 'You are working through practice problems together. Chris is struggling with a concept and looking for help.',
    personality: 'collaborative, uncertain, appreciative',
    socialCues: ['peer support', 'collaborative learning', 'patience']
  }
};

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Social Practice Simulator Backend API',
    status: 'running',
    endpoints: ['/api/health', '/api/start-session', '/api/conversation', '/api/end-session']
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeConnections: sessions.size });
});

app.post('/api/start-session', async (req, res) => {
  try {
    const { scenarioId } = req.body;
    const sessionId = uuidv4();
    const config = scenarioConfigs[scenarioId];
    
    if (!config) {
      return res.status(400).json({ error: 'Invalid scenario ID' });
    }
    
    const session = {
      id: sessionId,
      scenarioId,
      config,
      conversationHistory: [],
      startTime: Date.now(),
      stats: {
        turnCount: 0,
        responseTimes: [],
        socialCuesDetected: [],
        lastMessageTime: Date.now()
      }
    };
    
    sessions.set(sessionId, session);
    
    const initialMessage = await generateInitialMessage(config, session);
    
    res.json({
      sessionId,
      initialMessage,
      socialCues: config.socialCues
    });
  } catch (error) {
    console.error('❌ Error starting session:', error.message);
    res.status(500).json({ 
      error: 'Failed to start session', 
      details: error.message
    });
  }
});

app.post('/api/conversation', async (req, res) => {
  try {
    const { sessionId, userMessage } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Analyze user's emotional tone
    const userEmotion = await analyzeEmotion(userMessage);
    
    const responseTime = (Date.now() - session.stats.lastMessageTime) / 1000;
    session.stats.responseTimes.push(responseTime);
    session.stats.lastMessageTime = Date.now();
    session.stats.turnCount++;
    
    const { aiResponse, socialCues, hints } = await generateAIResponse(session, userMessage);
    
    // Detect sarcasm or ambiguity in AI response
    const aiSarcasm = await detectSarcasm(aiResponse);
    const isSarcastic = aiSarcasm && aiSarcasm[0]?.label === 'sarcasm' && aiSarcasm[0]?.score > 0.6;
    
    // Generate personalized hints
    const personalizedHints = generatePersonalizedHints(userEmotion, hints, isSarcastic);
    
    socialCues.forEach(cue => {
      if (!session.stats.socialCuesDetected.includes(cue)) {
        session.stats.socialCuesDetected.push(cue);
      }
    });
    
    const avgResponseTime = session.stats.responseTimes.reduce((a, b) => a + b, 0) / session.stats.responseTimes.length;
    
    res.json({
      aiResponse,
      socialCues,
      hints: personalizedHints,
      userEmotionFeedback: formatEmotionFeedback(userEmotion),
      sarcasmWarning: isSarcastic ? "⚠️ This response may contain sarcasm or indirect communication" : null,
      stats: {
        turnCount: session.stats.turnCount,
        avgResponseTime: avgResponseTime.toFixed(1),
        socialCuesDetected: session.stats.socialCuesDetected
      }
    });
  } catch (error) {
    console.error('❌ Error in conversation:', error.message);
    res.status(500).json({ 
      error: 'Failed to process message', 
      details: error.message
    });
  }
});

app.post('/api/end-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const analytics = await generateAnalytics(session);
    sessions.delete(sessionId);
    
    res.json({ analytics });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Helper function to call Groq API
async function callGroq(messages) {
  const API_KEY = process.env.GROQ_API_KEY;
  
  if (!API_KEY) {
    console.error('❌ GROQ_API_KEY not set in environment variables!');
    throw new Error('GROQ_API_KEY not configured');
  }
  
  console.log('✅ Calling Groq API...');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Groq API Error:', errorData);
    throw new Error(`Groq API error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  console.log('✅ Groq API response received');
  
  return data.choices[0].message.content;
}

async function generateInitialMessage(config, session) {
  const systemMessage = {
    role: 'system',
    content: `You are ${config.character} in this scenario: ${config.context}

Your personality: ${config.personality}

Generate a natural opening message to start the conversation. Keep it brief (2-3 sentences) and authentic to the scenario. Don't introduce yourself formally unless it's a first meeting scenario.`
  };
  
  session.conversationHistory = [systemMessage];
  
  const response = await callGroq([systemMessage]);
  
  session.conversationHistory.push({
    role: 'assistant',
    content: response
  });
  
  return response;
}

async function generateAIResponse(session, userMessage) {
  const config = session.config;
  
  // Add user message to history
  session.conversationHistory.push({
    role: 'user',
    content: userMessage
  });
  
  // Create instruction message for this turn
  const instructionMessage = {
    role: 'system',
    content: `You are ${config.character}. Personality: ${config.personality}

Key social cues to display: ${config.socialCues.join(', ')}

Instructions:
1. Stay in character
2. Respond naturally (2-4 sentences)
3. Display realistic emotions and reactions
4. Show natural social cues

After your response, on a new line add:
SOCIAL_CUES: [list 1-3 social cues you displayed]
HINTS: [list 1-2 helpful tips for the user's next response]`
  };
  
  const messages = [
    session.conversationHistory[0], // Original system message
    instructionMessage,
    ...session.conversationHistory.slice(1) // All conversation so far
  ];
  
  const fullResponse = await callGroq(messages);
  
  // Add AI response to history (without metadata)
  const parts = fullResponse.split('SOCIAL_CUES:');
  const aiResponse = parts[0].trim();
  
  session.conversationHistory.push({
    role: 'assistant',
    content: aiResponse
  });
  
  // Parse metadata
  let socialCues = [];
  let hints = [];
  
  if (parts[1]) {
    const hintsPart = parts[1].split('HINTS:');
    socialCues = hintsPart[0].trim()
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    if (hintsPart[1]) {
      hints = hintsPart[1].trim()
        .replace(/[\[\]]/g, '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
  }
  
  return { aiResponse, socialCues, hints };
}

async function generateAnalytics(session) {
  const duration = (Date.now() - session.startTime) / 1000;
  const avgResponseTime = session.stats.responseTimes.reduce((a, b) => a + b, 0) / session.stats.responseTimes.length;
  
  const transcript = session.conversationHistory
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => {
      return `${msg.role === 'user' ? 'User' : session.config.character}: ${msg.content}`;
    })
    .join('\n\n');
  
  const messages = [{
    role: 'user',
    content: `Analyze this social skills practice conversation and provide detailed feedback.

Scenario: ${session.config.context}
Number of turns: ${session.stats.turnCount}
Average response time: ${avgResponseTime.toFixed(1)}s

Conversation transcript:
${transcript}

Provide a JSON response with the following structure (respond ONLY with valid JSON, no other text):
{
  "overallScore": 75,
  "performanceLevel": "Good",
  "empathyScore": 70,
  "clarityScore": 80,
  "engagementScore": 75,
  "appropriatenessScore": 75,
  "improvementTips": [
    "specific actionable tip 1",
    "specific actionable tip 2",
    "specific actionable tip 3"
  ],
  "strengths": [
    "observed strength 1",
    "observed strength 2"
  ]
}

Evaluate based on: appropriate responses to social cues, empathy, clarity, engagement level, and contextual appropriateness.`
  }];
  
  try {
    const analysisText = await callGroq(messages);
    
    // Extract JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        ...analysis,
        totalTurns: session.stats.turnCount,
        avgResponseTime: avgResponseTime.toFixed(1),
        socialCuesDetected: session.stats.socialCuesDetected,
        duration: Math.floor(duration)
      };
    }
  } catch (e) {
    console.error('Error parsing analytics:', e);
  }
  
  // Fallback analytics
  return {
    overallScore: 75,
    performanceLevel: 'Good',
    empathyScore: 70,
    clarityScore: 80,
    engagementScore: 75,
    appropriatenessScore: 75,
    improvementTips: [
      'Practice active listening by acknowledging what others say',
      'Work on response timing to maintain natural conversation flow',
      'Use more varied vocabulary to express emotions clearly'
    ],
    strengths: ['Good engagement', 'Appropriate tone'],
    totalTurns: session.stats.turnCount,
    avgResponseTime: avgResponseTime.toFixed(1),
    socialCuesDetected: session.stats.socialCuesDetected,
    duration: Math.floor(duration)
  };
}

app.listen(PORT, () => {
  console.log(`Social Practice Simulator backend running on port ${PORT}`);
  console.log(`Using Groq API - Make sure GROQ_API_KEY is set`);
});
