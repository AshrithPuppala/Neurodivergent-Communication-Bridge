import os
import json
import time
from flask import Flask, request, jsonify
from openai import OpenAI
import assemblyai as aai

# --- 1. Initialization ---

print("Initializing Speech Analysis Server...")

# --- Grok API Client (for LLM Analysis) ---
try:
    grok_client = OpenAI(
        api_key=os.environ.get("XAI_API_KEY"),
        base_url="https://api.x.ai/v1"
    )
    print("Grok API client initialized successfully.")
except Exception as e:
    print(f"Error initializing Grok client: {e}")
    print("Please set your XAI_API_KEY environment variable.")

# --- AssemblyAI Client (for Transcription & Diarization) ---
try:
    aai.settings.api_key = os.environ.get("ASSEMBLYAI_API_KEY")
    if aai.settings.api_key is None:
        raise Exception("ASSEMBLYAI_API_KEY not set")
    print("AssemblyAI client initialized successfully.")
except Exception as e:
    print(f"Error initializing AssemblyAI client: {e}")

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Common filler words for scoring
FILLER_WORDS = {
    'um', 'uh', 'like', 'you know', 'so', 'i mean', 'right', 'okay',
    'well', 'actually', 'basically', 'literally', 'you see', 'kind of',
    'sort of', 'i guess', 'i think'
}

# --- 2. The System Prompt (for Grok) ---
SPEECH_COACH_PROMPT = """You are a professional speech-language pathologist analyzing speech patterns for disfluencies.

You will receive a JSON list of words with precise timestamps from a speaker's conversation.

Analyze for these specific speech disfluencies:
1. **Whole-Word Repetitions**: "I-I-I want to go" (same word repeated consecutively)
2. **Part-Word Repetitions**: "I wa-wa-want to go" (syllable repetition)
3. **Prolongations**: "Ssssso I went" (stretched sounds)
4. **Blocks/Long Pauses**: Unusual pauses >1.5 seconds between words
5. **Filler Words**: um, uh, like, you know, etc. (identify clusters)
6. **Interjections**: Mid-sentence fillers that disrupt speech flow

Return ONLY a valid JSON object with this EXACT structure (no markdown, no explanations):
{
  "feedback": [
    {
      "start_time": <number in seconds>,
      "end_time": <number in seconds>,
      "issue": "<specific issue type>",
      "suggestion": "<actionable improvement tip>",
      "severity": "low|medium|high"
    }
  ],
  "summary": {
    "total_issues": <number>,
    "filler_count": <number>,
    "repetition_count": <number>,
    "pause_count": <number>,
    "overall_assessment": "<2-3 sentence evaluation>",
    "speaking_rate": "fast|normal|slow",
    "fluency_percentage": <0-100>
  }
}

If no issues found, return empty feedback array. Be specific and constructive in suggestions."""

# --- 3. Helper Function: Get LLM Feedback from Grok ---
def get_feedback_for_speaker(speaker_words_list, speaker_id):
    """
    Sends a list of words to Grok API for detailed speech analysis
    and returns the feedback JSON.
    """
    if not speaker_words_list:
        return {
            "feedback": [],
            "summary": {
                "total_issues": 0,
                "filler_count": 0,
                "repetition_count": 0,
                "pause_count": 0,
                "overall_assessment": "No speech data available for this speaker.",
                "speaking_rate": "unknown",
                "fluency_percentage": 0
            }
        }
    
    try:
        # Convert AssemblyAI word objects to simple format
        formatted_list = [
            {
                "word": word.text,
                "start": round(word.start / 1000.0, 3),  # ms to seconds
                "end": round(word.end / 1000.0, 3)
            }
            for word in speaker_words_list
        ]
        
        user_content = json.dumps(formatted_list, indent=2)
        full_message = f"Analyze this speech data for Speaker {speaker_id}:\n\n{user_content}"
        
        # Call Grok API
        response = grok_client.chat.completions.create(
            model="grok-beta",
            messages=[
                {"role": "system", "content": SPEECH_COACH_PROMPT},
                {"role": "user", "content": full_message}
            ],
            temperature=0.3,
            max_tokens=2500
        )
        
        # Extract and parse response
        response_text = response.choices[0].message.content.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1]) if len(lines) > 2 else response_text
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()
        
        return json.loads(response_text)
    
    except json.JSONDecodeError as e:
        print(f"JSON parsing error from Grok: {e}")
        print(f"Response was: {response_text[:500]}")
        return {
            "feedback": [],
            "summary": {
                "total_issues": 0,
                "overall_assessment": "Analysis completed but response format was invalid."
            }
        }
    except Exception as e:
        print(f"Error analyzing speaker with Grok: {e}")
        return {
            "feedback": [],
            "summary": {
                "total_issues": 0,
                "overall_assessment": f"Analysis error: {str(e)}"
            }
        }

# --- 4. Helper Function: Score Disfluency ---
def calculate_disfluency_score(word_list):
    """
    Calculates a disfluency score based on fillers, repetitions, and pauses.
    Higher score = more disfluencies.
    """
    score = 0
    if not word_list:
        return 0
    
    for i, word in enumerate(word_list):
        clean_word = word.text.lower().strip(".,?!").strip()
        
        # Score filler words (weight: 2)
        if clean_word in FILLER_WORDS:
            score += 2
        
        if i > 0:
            prev_word = word_list[i-1]
            prev_clean_word = prev_word.text.lower().strip(".,?!").strip()
            
            # Score word repetitions (weight: 3)
            if clean_word == prev_clean_word and len(clean_word) > 1:
                score += 3
            
            # Score long pauses (AssemblyAI uses milliseconds)
            pause_duration_ms = word.start - prev_word.end
            if pause_duration_ms > 1500:  # >1.5 seconds
                score += 2
            elif pause_duration_ms > 2500:  # >2.5 seconds
                score += 3
    
    return score

# --- 5. Main Flask Route ---
@app.route('/analyze_conversation', methods=['POST'])
def handle_conversation_analysis():
    """
    Main endpoint: accepts audio file, performs diarization, transcription,
    and detailed speech analysis for both speakers.
    """
    
    if 'audio_file' not in request.files:
        return jsonify({"error": "No 'audio_file' part in the request"}), 400

    file = request.files['audio_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Validate file type
    allowed_extensions = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.webm'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        return jsonify({
            "error": f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        }), 400

    filename = f"{int(time.time())}_{file.filename}"
    temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        file.save(temp_path)
        print(f"File saved: {temp_path}")
        
        # --- STEP 1: Transcribe with AssemblyAI (includes diarization) ---
        print("Starting transcription and speaker diarization...")
        
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            speakers_expected=2
        )
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(temp_path, config)

        if transcript.status == aai.TranscriptStatus.error:
            return jsonify({"error": f"Transcription failed: {transcript.error}"}), 500
        
        if not transcript.words:
            return jsonify({"error": "No words transcribed. Audio may be too quiet or unclear."}), 500

        # --- STEP 2: Separate words by speaker ---
        print("Separating speakers...")
        speaker_a_words = []
        speaker_b_words = []
        
        for word in transcript.words:
            if word.speaker == 'A':
                speaker_a_words.append(word)
            elif word.speaker == 'B':
                speaker_b_words.append(word)

        if not speaker_a_words and not speaker_b_words:
            return jsonify({"error": "Speaker diarization failed. Could not identify separate speakers."}), 500
        
        print(f"Speaker A: {len(speaker_a_words)} words")
        print(f"Speaker B: {len(speaker_b_words)} words")

        # --- STEP 3: Calculate disfluency scores ---
        score_a = calculate_disfluency_score(speaker_a_words)
        score_b = calculate_disfluency_score(speaker_b_words)
        
        print(f"Speaker A Disfluency Score: {score_a}")
        print(f"Speaker B Disfluency Score: {score_b}")

        # --- STEP 4: Analyze BOTH speakers with Grok ---
        print("Analyzing both speakers with Grok AI...")
        analysis_a = get_feedback_for_speaker(speaker_a_words, 'A')
        analysis_b = get_feedback_for_speaker(speaker_b_words, 'B')

        # --- STEP 5: Generate transcript previews ---
        def get_transcript_preview(words, limit=100):
            if not words:
                return ""
            return " ".join([w.text for w in words[:limit]])
        
        # --- STEP 6: Return comprehensive results ---
        final_results = {
            "success": True,
            "speaker_a": {
                "word_count": len(speaker_a_words),
                "disfluency_score": score_a,
                "analysis": analysis_a,
                "transcript_preview": get_transcript_preview(speaker_a_words)
            },
            "speaker_b": {
                "word_count": len(speaker_b_words),
                "disfluency_score": score_b,
                "analysis": analysis_b,
                "transcript_preview": get_transcript_preview(speaker_b_words)
            },
            "comparison": {
                "primary_concern_speaker": 'A' if score_a > score_b else 'B',
                "score_difference": abs(score_a - score_b),
                "interpretation": f"Speaker {'A' if score_a > score_b else 'B'} shows more disfluencies ({max(score_a, score_b)} vs {min(score_a, score_b)} points)"
            },
            "full_transcript": transcript.text
        }
        
        print("Analysis complete!")
        return jsonify(final_results), 200

    except Exception as e:
        print(f"Error occurred: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500
        
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            print(f"Cleaned up: {temp_path}")

# --- 6. Health Check Endpoint ---
@app.route('/health', methods=['GET'])
def health_check():
    """Health check for deployment monitoring."""
    xai_configured = bool(os.environ.get("XAI_API_KEY"))
    aai_configured = bool(os.environ.get("ASSEMBLYAI_API_KEY"))
    
    status = "healthy" if (xai_configured and aai_configured) else "degraded"
    
    return jsonify({
        "status": status,
        "services": {
            "grok_api": "configured" if xai_configured else "missing",
            "assemblyai_api": "configured" if aai_configured else "missing"
        },
        "upload_folder": os.path.exists(UPLOAD_FOLDER)
    }), 200 if status == "healthy" else 503

# --- 7. Root Endpoint ---
@app.route('/', methods=['GET'])
def root():
    """API information endpoint."""
    return jsonify({
        "service": "Speech Analysis API",
        "version": "2.0",
        "endpoints": {
            "analyze": "POST /analyze_conversation",
            "health": "GET /health"
        },
        "supported_formats": ["mp3", "wav", "m4a", "flac", "ogg", "webm"],
        "max_file_size": "50MB"
    }), 200

# --- 8. Run the App ---
if __name__ == '__main__':
    print("\n" + "="*60)
    print("Speech Analysis Server Starting")
    print("="*60)
    print("\nEnvironment Check:")
    print(f"  XAI_API_KEY: {'✓ Set' if os.environ.get('XAI_API_KEY') else '✗ Missing'}")
    print(f"  ASSEMBLYAI_API_KEY: {'✓ Set' if os.environ.get('ASSEMBLYAI_API_KEY') else '✗ Missing'}")
    print(f"\nUpload folder: {UPLOAD_FOLDER}")
    print("\nEndpoints:")
    print("  GET  / - API information")
    print("  POST /analyze_conversation - Main analysis endpoint")
    print("  GET  /health - Health check")
    print("="*60 + "\n")
    
    # Use PORT from environment (Render sets this)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
