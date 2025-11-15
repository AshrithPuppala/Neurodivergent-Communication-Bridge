import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, MessageSquare, BarChart3, TrendingUp } from 'lucide-react';

const API_URL = 'https://neurodivergent-communication-bridge-4neh.onrender.com';

const scenarios = [
  { id: 'workplace_meeting', name: 'Team Meeting', context: 'workplace', difficulty: 'medium', description: 'Participate in a team standup meeting' },
  { id: 'job_interview', name: 'Job Interview', context: 'workplace', difficulty: 'hard', description: 'Handle a professional job interview' },
  { id: 'casual_chat', name: 'Coffee Shop Chat', context: 'social', difficulty: 'easy', description: 'Have a casual conversation with a friend' },
  { id: 'conflict_resolution', name: 'Resolving Disagreement', context: 'social', difficulty: 'hard', description: 'Navigate a disagreement with a colleague' },
  { id: 'class_presentation', name: 'Class Presentation Q&A', context: 'educational', difficulty: 'medium', description: 'Answer questions after a presentation' },
  { id: 'study_group', name: 'Study Group Discussion', context: 'educational', difficulty: 'easy', description: 'Collaborate in a study group' }
];

export default function SocialPracticeSimulator() {
  const [view, setView] = useState('selection');
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [showHints, setShowHints] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [conversationStats, setConversationStats] = useState({
    turnCount: 0,
    avgResponseTime: 0,
    socialCuesDetected: []
  });
  
  const [sensorySettings, setSensorySettings] = useState({
    reducedMotion: false,
    muteAudio: false,
    simplifiedUI: false,
    fontSize: 'normal'
  });
  
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        
        setCurrentTranscript(final || interim);
        
        if (final) {
          handleUserMessage(final);
          setCurrentTranscript('');
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async (scenario) => {
    setSelectedScenario(scenario);
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_URL}/api/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: scenario.id })
      });
      
      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages([{
        role: 'ai',
        content: data.initialMessage,
        cues: data.socialCues || [],
        timestamp: Date.now()
      }]);
      setView('conversation');
      
      speakMessage(data.initialMessage);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Make sure backend is running.');
    }
    
    setIsProcessing(false);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleUserMessage = useCallback(async (text) => {
  if (!text.trim() || isProcessing) return;
  // ... rest of the function stays the same
}, [sessionId, isProcessing, sensorySettings.muteAudio]);
    
    const userMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_URL}/api/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userMessage: text
        })
      });
      
      const data = await response.json();
      
      const aiMessage = {
        role: 'ai',
        content: data.aiResponse,
        cues: data.socialCues || [],
        hints: data.hints || [],
        userEmotionFeedback: data.userEmotionFeedback || null,
        sarcasmWarning: data.sarcasmWarning || null,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setConversationStats(data.stats);
      
      speakMessage(data.aiResponse);
    } catch (error) {
      console.error('Error in conversation:', error);
    }
    
    setIsProcessing(false);
  };

  const speakMessage = (text) => {
    if (sensorySettings.muteAudio) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const endSession = async () => {
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_URL}/api/end-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      
      const data = await response.json();
      setAnalytics(data.analytics);
      setView('results');
    } catch (error) {
      console.error('Error ending session:', error);
    }
    
    setIsProcessing(false);
    
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const renderSensoryControls = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="font-bold text-sm text-gray-700 mb-3">🎨 Comfort Settings</h3>
      
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input 
            type="checkbox" 
            checked={sensorySettings.reducedMotion}
            onChange={(e) => setSensorySettings({...sensorySettings, reducedMotion: e.target.checked})}
            className="rounded"
          />
          <span>Reduce animations</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input 
            type="checkbox" 
            checked={sensorySettings.muteAudio}
            onChange={(e) => setSensorySettings({...sensorySettings, muteAudio: e.target.checked})}
            className="rounded"
          />
          <span>Mute AI voice</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input 
            type="checkbox" 
            checked={sensorySettings.simplifiedUI}
            onChange={(e) => setSensorySettings({...sensorySettings, simplifiedUI: e.target.checked})}
            className="rounded"
          />
          <span>Simplified view</span>
        </label>
        
        <div>
          <label className="text-sm text-gray-700 block mb-1">Text Size</label>
          <select 
            value={sensorySettings.fontSize}
            onChange={(e) => setSensorySettings({...sensorySettings, fontSize: e.target.value})}
            className="w-full rounded border p-1 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra Large</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderConversation = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{selectedScenario?.name}</h2>
           <p className="text-sm text-gray-600">Turn {conversationStats?.turnCount || 0} • Practice Session</p>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowHints(!showHints)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showHints ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Hints {showHints ? 'On' : 'Off'}
            </button>
            <button
              onClick={endSession}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {renderSensoryControls()}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white'} rounded-2xl p-4 shadow-sm ${
                sensorySettings.fontSize === 'large' ? 'text-lg' : 
                sensorySettings.fontSize === 'xlarge' ? 'text-xl' : 
                'text-base'
              }`}>
                <p className={msg.role === 'user' ? 'text-white' : 'text-gray-800'}>{msg.content}</p>
                
                {msg.role === 'ai' && msg.userEmotionFeedback && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-purple-600 mb-2">
                      📊 Your Communication Analysis
                    </p>
                    <div className="bg-purple-50 rounded p-2 text-xs">
                      <span className="text-2xl">{msg.userEmotionFeedback.emoji}</span>
                      <span className="ml-2">{msg.userEmotionFeedback.message}</span>
                      <span className="ml-2 text-purple-700">({msg.userEmotionFeedback.confidence})</span>
                    </div>
                  </div>
                )}
                
                {msg.role === 'ai' && msg.sarcasmWarning && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-2">
                    <p className="text-xs text-yellow-800">{msg.sarcasmWarning}</p>
                  </div>
                )}
                
                {msg.role === 'ai' && msg.cues && msg.cues.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Social Cues Detected:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.cues.map((cue, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {cue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {showHints && msg.hints && msg.hints.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-indigo-600 mb-2">💡 Hints:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {msg.hints.map((hint, i) => (
                        <li key={i}>• {hint}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`p-4 rounded-full transition-all ${
                isListening 
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} text-white`}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            
            <div className="flex-1 bg-gray-100 rounded-lg p-4">
              {isListening ? (
                <p className="text-gray-600">
                  {currentTranscript || 'Listening... Speak now'}
                </p>
              ) : (
                <p className="text-gray-400">Click the microphone to start speaking</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScenarioSelection = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Social Practice Simulator</h1>
          <p className="text-xl text-gray-600">Build confidence through realistic AI-powered conversations</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map(scenario => (
            <div key={scenario.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => startConversation(scenario)}>
              <div className="flex items-start justify-between mb-4">
                <div className="bg-indigo-100 p-3 rounded-lg">
                  <MessageSquare className="text-indigo-600" size={24} />
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  scenario.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                  scenario.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {scenario.difficulty}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">{scenario.name}</h3>
              <p className="text-gray-600 mb-4">{scenario.description}</p>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 capitalize">{scenario.context}</span>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                  Start
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Session Complete! 🎉</h1>
          <p className="text-lg text-gray-600">Here's how you did</p>
        </div>
        
        {analytics && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Overall Score</h3>
                  <TrendingUp className="text-green-500" />
                </div>
                <p className="text-4xl font-bold text-indigo-600">{analytics.overallScore}/100</p>
                <p className="text-sm text-gray-600 mt-2">{analytics.performanceLevel}</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Turn Count</h3>
                  <MessageSquare className="text-blue-500" />
                </div>
                <p className="text-4xl font-bold text-indigo-600">{analytics.totalTurns}</p>
                <p className="text-sm text-gray-600 mt-2">Conversation exchanges</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Avg Response Time</h3>
                  <BarChart3 className="text-purple-500" />
                </div>
                <p className="text-4xl font-bold text-indigo-600">{analytics.avgResponseTime}s</p>
                <p className="text-sm text-gray-600 mt-2">Response timing</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Social Cues Recognized</h3>
              <div className="flex flex-wrap gap-3">
                {analytics.socialCuesDetected?.map((cue, idx) => (
                  <span key={idx} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium">
                    {cue}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-4">💡 Improvement Tips</h3>
              <ul className="space-y-3">
                {analytics.improvementTips?.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="bg-indigo-100 text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      {idx + 1}
                    </span>
                    <p className="text-gray-700">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Detailed Metrics</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Empathy Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{width: `${analytics.empathyScore}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{analytics.empathyScore}%</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Clarity Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-500 h-3 rounded-full transition-all"
                        style={{width: `${analytics.clarityScore}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{analytics.clarityScore}%</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Engagement Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-purple-500 h-3 rounded-full transition-all"
                        style={{width: `${analytics.engagementScore}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{analytics.engagementScore}%</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Appropriateness Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-orange-500 h-3 rounded-full transition-all"
                        style={{width: `${analytics.appropriatenessScore}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{analytics.appropriatenessScore}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => {
              setView('selection');
              setMessages([]);
              setSessionId(null);
              setAnalytics(null);
            }}
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
          >
            Practice Another Scenario
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {view === 'selection' && renderScenarioSelection()}
      {view === 'conversation' && renderConversation()}
      {view === 'results' && renderResults()}
    </div>
  );
}
