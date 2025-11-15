// server.js - Backend with Google Gemini API (FREE)
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { HfInference } = require('@huggingface/inference');

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

// Initialize Hugging Face
const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);
// Emotion detection function
async function analyzeEmotion(text) {
  try {
    const result = await hf.textClassification({
      model: 'j-hartmann/emotion-english-distilroberta-base',
      inputs: text
    });
    return result;
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return null;
  }
}

// Detect sarcasm
async function detectSarcasm(text) {
  try {
    const result = await hf.textClassification({
      model: 'mrm8488/t5-base-finetuned-sarcasm-twitter',
      inputs: text
    });
    return result;
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
  // ... rest of your code

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
      messages: [],
      startTime: Date.now(),
      stats: {
        turnCount: 0,
        responseTimes: [],
        socialCuesDetected: [],
        lastMessageTime: Date.now()
      }
    };
    
    sessions.set(sessionId, session);
    
    const initialMessage = await generateInitialMessage(config);
    
    session.messages.push({
      role: 'model',
      parts: [{ text: initialMessage }]
    });
    
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
    
    session.messages.push({
      role: 'user',
      parts: [{ text: userMessage }],
      emotion: userEmotion
    });
    
    const { aiResponse, socialCues, hints } = await generateAIResponse(session, userMessage);
    
    // Detect sarcasm or ambiguity in AI response
    const aiSarcasm = await detectSarcasm(aiResponse);
    const isSarcastic = aiSarcasm && aiSarcasm[0]?.label === 'sarcasm' && aiSarcasm[0]?.score > 0.6;
    
    // Generate personalized hints
    const personalizedHints = generatePersonalizedHints(userEmotion, hints, isSarcastic);
    
    session.messages.push({
      role: 'model',
      parts: [{ text: aiResponse }],
      sarcasmDetected: isSarcastic
    });
    
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

// Helper function to call Gemini API
async function callGemini(prompt, conversationHistory = null) {
  const API_KEY = process.env.GOOGLE_API_KEY;
  
  if (!API_KEY) {
    console.error('❌ GOOGLE_API_KEY not set in environment variables!');
    throw new Error('GOOGLE_API_KEY not configured');
  }
  
  console.log('✅ Calling Gemini API...');
 const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  
  let contents;
  if (conversationHistory) {
    contents = conversationHistory;
  } else {
    contents = [{
      parts: [{ text: prompt }]
    }];
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Gemini API Error:', errorData);
    throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  console.log('✅ Gemini API response received');
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text;
  }
  
  throw new Error('Invalid response from Gemini API');
}

async function generateInitialMessage(config) {
  const prompt = `You are ${config.character} in this scenario: ${config.context}

Your personality: ${config.personality}

Generate a natural opening message to start the conversation. Keep it brief (2-3 sentences) and authentic to the scenario. Don't introduce yourself formally unless it's a first meeting scenario.`;
  
  return await callGemini(prompt);
}

async function generateAIResponse(session, userMessage) {
  const config = session.config;
  
  const systemPrompt = `You are ${config.character} in this scenario: ${config.context}

Your personality: ${config.personality}

Key social cues to display naturally: ${config.socialCues.join(', ')}

Instructions:
1. Stay in character throughout the conversation
2. Respond naturally as this character would
3. Display realistic emotions, reactions, and speech patterns
4. Keep responses conversational (2-4 sentences typically)
5. Show natural social cues through your tone and word choice
6. React authentically to what the user says

After your response, on a new line, add:
SOCIAL_CUES: [list 1-3 social cues you displayed in this response]
HINTS: [list 1-2 helpful tips for the user's next response]`;

  // Build conversation history for Gemini
  const conversationHistory = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'I understand. I will stay in character and provide social cues and hints.' }] }
  ];
  
  // Add conversation messages
  session.messages.forEach(msg => {
    conversationHistory.push(msg);
  });
  
  const fullResponse = await callGemini(null, conversationHistory);
  
  // Parse response
  const parts = fullResponse.split('SOCIAL_CUES:');
  const aiResponse = parts[0].trim();
  
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
  
  const transcript = session.messages
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map(msg => {
      const text = msg.parts[0].text;
      return `${msg.role === 'user' ? 'User' : session.config.character}: ${text}`;
    })
    .join('\n\n');
  
  const prompt = `Analyze this social skills practice conversation and provide detailed feedback.

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

Evaluate based on: appropriate responses to social cues, empathy, clarity, engagement level, and contextual appropriateness.`;
  
  try {
    const analysisText = await callGemini(prompt);
    
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
  console.log(`Using Google Gemini API - Make sure GOOGLE_API_KEY is set`);
});
