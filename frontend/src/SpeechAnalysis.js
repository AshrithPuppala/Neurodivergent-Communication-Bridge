import React, { useState } from 'react';
import { Upload, ArrowLeft, Loader } from 'lucide-react';

export default function SpeechAnalysis({ onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResults(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an audio file first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio_file', selectedFile);

    try {
      // TODO: Replace with your actual Python Flask backend URL on Render after deployment
      const PYTHON_BACKEND_URL = 'https://neurodivergent-communication-bridge-part1.onrender.com';
      
      const response = await fetch(`${PYTHON_BACKEND_URL}/analyze_conversation`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError('Failed to analyze audio. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Speech Analysis</h1>
          <p className="text-gray-600 mb-8">Upload a conversation recording for AI-powered analysis</p>

          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center mb-6 hover:border-purple-500 transition-colors">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-700 mb-4 font-medium">
              {selectedFile ? selectedFile.name : 'Choose an audio file'}
            </p>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <label
              htmlFor="audio-upload"
              className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors"
            >
              Select File
            </label>
            <p className="text-sm text-gray-500 mt-4">
              Supported formats: MP3, WAV, M4A, etc.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || isAnalyzing}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader className="animate-spin" size={20} />
                Analyzing...
              </>
            ) : (
              'Analyze Conversation'
            )}
          </button>

          {/* Results Section */}
          {results && (
            <div className="mt-8 space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Analysis Results</h2>
                <p className="text-gray-700 mb-4">
                  <strong>Analyzed Speaker:</strong> Speaker {results.analyzed_speaker_id}
                </p>
                <p className="text-sm text-gray-600">{results.reason}</p>
              </div>

              {results.feedback && results.feedback.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-800">Feedback & Suggestions</h3>
                  {results.feedback.map((item, idx) => (
                    <div key={idx} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                          {item.issue}
                        </span>
                        {item.start_time !== undefined && (
                          <span className="text-sm text-gray-500">
                            {item.start_time.toFixed(1)}s - {item.end_time.toFixed(1)}s
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700">{item.suggestion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <p className="text-green-800 font-medium">
                    ✓ Great job! No significant disfluencies detected.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
