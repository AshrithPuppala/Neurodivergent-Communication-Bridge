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

// Enhanced emotion feedback for neurodivergent users
function formatEmotionFeedback(emotions) {
  if (!emotions || emotions.length === 0) return null;
  
  const topEmotion = emotions[0];
  const secondEmotion = emotions[1];
  
  const emotionEmojis = {
    joy: '😊',
    sadness: '😢',
    anger: '😠',
    fear: '😰',
    surprise: '😮',
    neutral: '😐',
    disgust: '😖'
  };
  
  const emotionExplanations = {
    joy: {
      description: 'Your message sounds positive and cheerful',
      tip: 'Great! Your enthusiasm comes through clearly',
      impact: 'This tone helps build rapport and shows engagement'
    },
    sadness: {
      description: 'Your message may sound down or disappointed',
      tip: 'It\'s okay to express this, but consider if you want to adjust your tone',
      impact: 'Others might respond with concern or support'
    },
    anger: {
      description: 'Your message might come across as frustrated or upset',
      tip: 'Take a breath. Consider rephrasing if this wasn\'t intended',
      impact: 'This could make the other person defensive or uncomfortable'
    },
    fear: {
      description: 'Your message may sound worried or anxious',
      tip: 'It\'s okay to feel uncertain. You\'re doing great!',
      impact: 'Others might try to reassure you'
    },
    surprise: {
      description: 'Your message shows unexpected reaction',
      tip: 'Your genuine reaction is clear',
      impact: 'This can show you\'re engaged and interested'
    },
    neutral: {
      description: 'Your message has a balanced, calm tone',
      tip: 'Clear and professional communication',
      impact: 'Good for formal or informational exchanges'
    },
    disgust: {
      description: 'Your message might sound dismissive or disapproving',
      tip: 'Consider if this matches your intention',
      impact: 'This could create tension or hurt feelings'
    }
  };
  
  const emotionData = emotionExplanations[topEmotion.label] || emotionExplanations.neutral;
  
  return {
    emotion: topEmotion.label,
    confidence: Math.round(topEmotion.score * 100),
    emoji: emotionEmojis[topEmotion.label] || '🙂',
    description: emotionData.description,
    tip: emotionData.tip,
    impact: emotionData.impact,
    secondary: secondEmotion ? {
      emotion: secondEmotion.label,
      confidence: Math.round(secondEmotion.score * 100),
      emoji: emotionEmojis[secondEmotion.label]
    } : null,
    allEmotions: emotions.slice(0, 3).map(e => ({
      label: e.label,
      percentage: Math.round(e.score * 100)
    }))
  };
}

// Generate highly personalized hints for neurodivergent users
function generatePersonalizedHints(emotion, baseHints, isSarcastic, userMessage) {
  const hints = [];
  
  // Add base hints from AI
  hints.push(...baseHints);
  
  // Emotion-based guidance
  if (emotion && emotion.length > 0) {
    const topEmotion = emotion[0];
    const emotionScore = topEmotion.score;
    
    if (topEmotion.label === 'anger' && emotionScore > 0.5) {
      hints.push("🧘 Emotion Check: Your response sounds angry. Take 3 deep breaths before continuing.");
      hints.push("💡 Reframe Tip: Try starting with 'I understand...' or 'I see your point...'");
    }
    
    if (topEmotion.label === 'fear' && emotionScore > 0.5) {
      hints.push("💪 Confidence Boost: You're doing great! It's normal to feel uncertain.");
      hints.push("🎯 Action: Focus on what you DO know, not what you don't.");
    }
    
    if (topEmotion.label === 'sadness' && emotionScore > 0.5) {
      hints.push("💚 Self-Care: Take your time. There's no rush in this conversation.");
      hints.push("🌟 Remember: This is practice. Mistakes are learning opportunities.");
    }
    
    if (topEmotion.label === 'joy' && emotionScore > 0.7) {
      hints.push("✨ Great energy! Your enthusiasm is clear and engaging.");
    }
    
    if (topEmotion.label === 'neutral' && emotionScore > 0.6) {
      hints.push("📊 Balanced tone detected. This works well for professional settings.");
      hints.push("💭 Consider: Would adding warmth help build connection?");
    }
  }
  
  // Sarcasm detection with detailed explanation
  if (isSarcastic) {
    hints.push("⚠️ SARCASM ALERT: The other person may be saying the opposite of what they mean.");
    hints.push("🔍 Look for: Tone mismatch, exaggeration, or context clues that suggest irony.");
    hints.push("💬 If unsure, it's okay to ask: 'Are you being serious or joking?'");
  }
  
  // Message length feedback
  const wordCount = userMessage.trim().split(/\s+/).length;
  if (wordCount < 3) {
    hints.push("💬 Try elaborating more. Short responses can seem disengaged.");
  } else if (wordCount > 50) {
    hints.push("📝 Consider breaking long thoughts into smaller chunks for clarity.");
  }
  
  // Question detection
  if (userMessage.includes('?')) {
    hints.push("❓ Good! Asking questions shows engagement and curiosity.");
  } else if (hints.length < 4) {
    hints.push("💡 Tip: Try asking a follow-up question to show interest.");
  }
  
  return hints.slice(0, 5); // Limit to 5 most relevant hints
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
        emotionHistory: [],
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
    
    // Track emotion history
    if (userEmotion && userEmotion[0]) {
      session.stats.emotionHistory.push({
        emotion: userEmotion[0].label,
        score: userEmotion[0].score,
        timestamp: Date.now()
      });
    }
    
    const responseTime = (Date.now() - session.stats.lastMessageTime) / 1000;
    session.stats.responseTimes.push(responseTime);
    session.stats.lastMessageTime = Date.now();
    session.stats.turnCount++;
    
    const { aiResponse, socialCues, hints } = await generateAIResponse(session, userMessage);
    
    // Detect sarcasm or ambiguity in AI response
    const aiSarcasm = await detectSarcasm(aiResponse);
    const isSarcastic = aiSarcasm && aiSarcasm[0]?.label === 'sarcasm' && aiSarcasm[0]?.score > 0.6;
    
    // Generate highly personalized hints
    const personalizedHints = generatePersonalizedHints(userEmotion, hints, isSarcastic, userMessage);
    
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
      sarcasmWarning: isSarcastic ? {
        detected: true,
        message: "⚠️ INDIRECT COMMUNICATION DETECTED",
        explanation: "The other person may be using sarcasm, irony, or saying the opposite of what they mean. Look for context clues!",
        confidence: Math.round(aiSarcasm[0].score * 100)
      } : null,
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
  
  // Emotion pattern analysis
  const emotionCounts = {};
  session.stats.emotionHistory.forEach(e => {
    emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
  });
  
  const dominantEmotion = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
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
Dominant emotion: ${dominantEmotion ? dominantEmotion[0] : 'neutral'}

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
  "emotionalRegulationScore": 70,
  "improvementTips": [
    "specific actionable tip 1",
    "specific actionable tip 2",
    "specific actionable tip 3"
  ],
  "strengths": [
    "observed strength 1",
    "observed strength 2"
  ],
  "neurodivergentInsights": [
    "specific insight about communication patterns",
    "recognition of progress or challenges"
  ]
}

Evaluate based on: appropriate responses to social cues, empathy, clarity, engagement level, emotional regulation, and contextual appropriateness.`
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
        duration: Math.floor(duration),
        emotionPattern: dominantEmotion ? {
          dominant: dominantEmotion[0],
          occurrences: dominantEmotion[1],
          distribution: emotionCounts
        } : null
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
    emotionalRegulationScore: 70,
    improvementTips: [
      'Practice active listening by acknowledging what others say',
      'Work on response timing to maintain natural conversation flow',
      'Use more varied vocabulary to express emotions clearly'
    ],
    strengths: ['Good engagement', 'Appropriate tone'],
    neurodivergentInsights: [
      'You maintained focus throughout the conversation',
      'Your responses showed clear thought patterns'
    ],
    totalTurns: session.stats.turnCount,
    avgResponseTime: avgResponseTime.toFixed(1),
    socialCuesDetected: session.stats.socialCuesDetected,
    duration: Math.floor(duration),
    emotionPattern: dominantEmotion ? {
      dominant: dominantEmotion[0],
      occurrences: dominantEmotion[1],
      distribution: emotionCounts
    } : null
  };
}

app.listen(PORT, () => {
  console.log(`Social Practice Simulator backend running on port ${PORT}`);
  console.log(`Using Groq API - Make sure GROQ_API_KEY is set`);
});
