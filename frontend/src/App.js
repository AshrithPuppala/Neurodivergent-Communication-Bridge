import React, { useState } from 'react';
import LandingPage from './LandingPage';
import SpeechAnalysis from './SpeechAnalysis';
import SocialPracticeSimulator from './SocialPracticeSimulator';

export default function App() {
  const [currentTool, setCurrentTool] = useState(null);

  const renderCurrentView = () => {
    switch (currentTool) {
      case 'speech-analysis':
        return <SpeechAnalysis onBack={() => setCurrentTool(null)} />;
      case 'practice-simulator':
        return <SocialPracticeSimulator onBack={() => setCurrentTool(null)} />;
      default:
        return <LandingPage onSelectTool={setCurrentTool} />;
    }
  };

  return <div className="App">{renderCurrentView()}</div>;
}
