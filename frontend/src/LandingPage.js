import React from 'react';
import { MessageSquare, Mic } from 'lucide-react';

export default function LandingPage({ onSelectTool }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-gray-800 mb-4">
            Neurodivergent Communication Bridge
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            AI-Powered Tools for Enhanced Communication
          </p>
          <p className="text-md text-gray-500">
            Choose a tool to get started
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Part 1: Speech Analysis */}
          <div 
            onClick={() => onSelectTool('speech-analysis')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all cursor-pointer transform hover:scale-105 border-2 border-transparent hover:border-indigo-500"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="bg-purple-100 p-4 rounded-xl">
                <Mic className="text-purple-600" size={40} />
              </div>
              <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                Real-time Analysis
              </span>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Speech Analysis
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Upload conversation recordings to receive detailed analysis of speech patterns, 
              disfluencies, and personalized feedback using AI-powered transcription and coaching.
            </p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>Speaker diarization (identifies who's speaking)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>Stutter & filler word detection</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>Professional coaching feedback</span>
              </div>
            </div>
            
            <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors">
              Analyze Conversation →
            </button>
          </div>

          {/* Part 2: Practice Simulator */}
          <div 
            onClick={() => onSelectTool('practice-simulator')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all cursor-pointer transform hover:scale-105 border-2 border-transparent hover:border-indigo-500"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="bg-indigo-100 p-4 rounded-xl">
                <MessageSquare className="text-indigo-600" size={40} />
              </div>
              <span className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                Interactive Practice
              </span>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Practice Simulator
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Build confidence through realistic AI-powered conversation scenarios. 
              Practice social interactions in a safe, judgment-free environment with real-time feedback.
            </p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>Real-time emotion detection</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>Sarcasm & social cue alerts</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>Multiple practice scenarios</span>
              </div>
            </div>
            
            <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
              Start Practicing →
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            🧠 Designed specifically for neurodivergent individuals | Built with AI & empathy
          </p>
        </div>
      </div>
    </div>
  );
}
