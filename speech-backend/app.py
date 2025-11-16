import React, { useState, useRef } from 'react';
import { Upload, Loader, ArrowLeft, AlertCircle } from 'lucide-react';

const API_URL = 'https://neurodivergent-communication-bridge-4neh.onrender.com';

export default function SpeechAnalysis({ onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/m4a', 'audio/mp4'];
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const validExtensions = ['mp3', 'wav', 'm4a', 'mp4'];
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        setError('Please select a valid audio file (MP3, WAV, M4A)');
        return;
      }
      
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      setResults(null);
    }
  };

  const analyzeAudio = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio_file', selectedFile);

      console.log('Sending file to:', `${API_URL}/analyze_conversation`);
      
      const response = await fetch(`${API_URL}/analyze_conversation`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for FormData
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Analysis results:', data);
      
      setResults(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze audio. Please check your connection and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setSelectedFile(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderResults = () => {
    if (!results) return null;

    const { analyzed_speaker_id, feedback, scores, reason } = results;
    const isFeedbackString = typeof feedback === 'string';

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Analysis Results</h2>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                {analyzed_speaker_id}
              </div>
              <div className="flex-1">
                <p className="font-bold text-blue-900 mb-1">Analyzed Speaker: {analyzed_speaker_id}</p>
                <p className="text-sm text-blue-800">{reason}</p>
              </div>
            </div>
          </div>

          {scores && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-gray-700 mb-3">Disfluency Scores</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded p-3">
                  <p className="text-sm text-gray-600 mb-1">Speaker A</p>
                  <p className="text-2xl font-bold text-indigo-600">{scores.speaker_a}</p>
                </div>
                <div className="bg-white rounded p-3">
                  <p className="text-sm text-gray-600 mb-1">Speaker B</p>
                  <p className="text-2xl font-bold text-indigo-600">{scores.speaker_b}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                *Higher scores indicate more disfluencies (fillers, repetitions, pauses)
              </p>
            </div>
          )}

          {isFeedbackString ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 text-center">
              <span className="text-4xl mb-3 block">🎉</span>
              <p className="text-2xl font-bold text-green-700">{feedback}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-700 mb-3">Speech Feedback</h3>
              {feedback.map((item, index) => (
                <div key={index} className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-yellow-900 text-sm">{item.issue}</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Time: {item.start_time?.toFixed(2)}s - {item.end_time?.toFixed(2)}s
                      </p>
                    </div>
                  </div>
                  <div className="bg-white rounded p-3 mt-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">💡 Tip: </span>
                      {item.suggestion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={resetAnalysis}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
        >
          Analyze Another Recording
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Home</span>
          </button>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Speech Analysis</h1>
            <p className="text-gray-600">Upload a conversation recording for AI-powered analysis</p>
          </div>

          {!results ? (
            <div className="space-y-6">
              <div 
                className="border-3 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-700 font-medium mb-2">
                  {selectedFile ? selectedFile.name : 'Click to select audio file'}
                </p>
                <p className="text-sm text-gray-500">
                  Supported formats: MP3, WAV, M4A, etc.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.mp4"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
                  <div>
                    <p className="font-bold text-red-900">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <button
                onClick={analyzeAudio}
                disabled={!selectedFile || isAnalyzing}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  !selectedFile || isAnalyzing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader className="animate-spin" size={24} />
                    Analyzing... This may take a minute
                  </span>
                ) : (
                  'Analyze Conversation'
                )}
              </button>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <p className="text-sm text-blue-900">
                  <span className="font-bold">How it works:</span> Upload an audio file containing a conversation. 
                  Our AI will transcribe the audio, identify speakers, and analyze speech patterns to provide 
                  personalized feedback on disfluencies like stutters, stammers, and filler words.
                </p>
              </div>
            </div>
          ) : (
            renderResults()
          )}
        </div>
      </div>
    </div>
  );
}
