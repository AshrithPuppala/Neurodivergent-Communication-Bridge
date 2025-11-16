import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- 1. Library Imports ---
import google.generativeai as genai
import assemblyai as aai

# --- 2. Initialization ---

# --- Google Gemini Client (for LLM Analysis) ---
try:
    # Get API key from environment variable
    google_api_key = os.environ.get("GOOGLE_API_KEY")
    if not google_api_key:
        raise Exception("GOOGLE_API_KEY environment variable not set")
    
    genai.configure(api_key=google_api_key) 
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
    print("✓ Gemini client initialized successfully.")
except Exception as e:
    print(f"✗ Error initializing Google Gemini client: {e}")
    gemini_model = None

# --- AssemblyAI Client (for Transcription & Diarization) ---
try:
    assemblyai_api_key = os.environ.get("ASSEMBLYAI_API_KEY")
    if not assemblyai_api_key:
        raise Exception("ASSEMBLYAI_API_KEY environment variable not set")
    
    aai.settings.api_key = assemblyai_api_key
    print("✓ AssemblyAI client initialized successfully.")
except Exception as e:
    print(f"✗ Error initializing AssemblyAI client: {e}")

app = Flask(__name__)

# CORS configuration - allow all origins with credentials
CORS(app, 
     resources={r"/*": {
         "origins": "*",
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type"],
         "supports_credentials": False
     }}
)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# A set of common filler words for quick checking.
FILLER_WORDS = {
    'um', 'uh', 'like', 'you know', 'so', 'i mean', 'right', 'okay'
}

# --- 3. The System Prompt (for Gemini) ---
SPEECH_COACH_PROMPT = """
You are a professional speech-language pathologist. You will be given a JSON 
list of words from a user's speech, complete with 'start' and 'end' timestamps.
Your task is to analyze this transcript for speech disfluencies,
which include stutters and stammers.

Specifically, look for:
1. *Whole-Word Repetitions:* (e.g., "I-I-I want to go").
2. *Blocks / Long Pauses:* (e.g., a long pause before a word, "I want... [2.0 sec pause] ...to go").
3. *Interjections / Fillers:* (e.g., "I, uh, want to, um, go").

Analyze the data and return a JSON object with a single key "feedback", 
which contains a list of suggestion objects. 

Each suggestion object must have the following keys:
- "start_time": The start time of the issue (in seconds).
- "end_time": The end time of the issue (in seconds).
- "issue": A short description (e.g., "Stutter (Repetition)", "Stammer (Block)", "Filler Word").
- "suggestion": A brief, constructive tip for improvement.

If no issues are found, return an empty "feedback" list.
ONLY output the raw JSON object, starting with { and ending with }.
"""

# --- 4. Helper Function: Get LLM Feedback ---
def get_feedback_for_speaker(speaker_words_list):
    """
    Sends a list of words to Google Gemini API for analysis 
    and returns the feedback JSON.
    """
    if not speaker_words_list:
        return {"feedback": []}
    
    if not gemini_model:
        return {"feedback": [{"issue": "API Error", "suggestion": "Gemini API not initialized"}]}
    
    try:
        # Convert AssemblyAI word objects to a simple format for Gemini
        formatted_list = []
        for word in speaker_words_list:
            # Handle both dict and object formats
            if isinstance(word, dict):
                formatted_list.append({
                    "word": word.get('text', ''),
                    "start": word.get('start', 0) / 1000.0,
                    "end": word.get('end', 0) / 1000.0
                })
            else:
                formatted_list.append({
                    "word": word.text,
                    "start": word.start / 1000.0,
                    "end": word.end / 1000.0
                })
        
        user_content = json.dumps(formatted_list)
        
        full_prompt = f"{SPEECH_COACH_PROMPT}\n\nHere is the speech data:\n{user_content}"
        
        response = gemini_model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json" 
            )
        )
        
        return json.loads(response.text)
    
    except Exception as e:
        print(f"Error analyzing speaker with Gemini: {e}")
        return {"feedback": [{"issue": "Analysis Error", "suggestion": str(e)}]}

# --- 5. Helper Function: Score Disfluency ---
def calculate_disfluency_score(word_list):
    """
    Calculates a simple disfluency score based on fillers, 
    repetitions, and pauses from AssemblyAI word objects.
    """
    score = 0
    if not word_list:
        return 0
    
    for i, word in enumerate(word_list):
        # Handle both dict and object formats
        if isinstance(word, dict):
            word_text = word.get('text', '')
            word_start = word.get('start', 0)
            word_end = word.get('end', 0)
        else:
            word_text = word.text
            word_start = word.start
            word_end = word.end
            
        clean_word = word_text.lower().strip(".,?!")
        
        # Check for filler words
        if clean_word in FILLER_WORDS:
            score += 1
            
        if i > 0:
            prev_word = word_list[i-1]
            if isinstance(prev_word, dict):
                prev_word_text = prev_word.get('text', '')
                prev_word_end = prev_word.get('end', 0)
            else:
                prev_word_text = prev_word.text
                prev_word_end = prev_word.end
                
            prev_clean_word = prev_word_text.lower().strip(".,?!")
            
            # Check for repetition
            if clean_word == prev_clean_word and len(clean_word) > 0:
                score += 1
                
            # Check for long pause (AssemblyAI timestamps are in milliseconds)
            pause_duration_ms = word_start - prev_word_end
            if pause_duration_ms > 1500:  # 1.5 seconds
                score += 1
    
    return score

# --- 6. Health Check Endpoint ---
@app.route('/', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return '', 204
    return jsonify({
        "status": "healthy",
        "message": "Speech Analysis API is running",
        "endpoints": {
            "analyze": "/analyze_conversation (POST)"
        }
    }), 200

# --- 7. The Main Flask Route ---
@app.route('/analyze_conversation', methods=['POST', 'OPTIONS'])
def handle_conversation_analysis():
    """
    Main endpoint to analyze speech from an audio file.
    Expects a POST request with 'audio_file' in multipart/form-data.
    """
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
    
    if 'audio_file' not in request.files:
        return jsonify({"error": "No 'audio_file' part in the request"}), 400

    file = request.files['audio_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filename = f"{int(time.time())}_{file.filename}"
    temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        # Save the uploaded file
        file.save(temp_path)
        print(f"File saved to: {temp_path}")
        
        # --- STEP 1: Call AssemblyAI API ---
        print("Starting transcription and diarization with AssemblyAI...")
        
        config = aai.TranscriptionConfig(speaker_labels=True)
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(temp_path, config)

        if transcript.status == aai.TranscriptStatus.error:
            return jsonify({"error": f"AssemblyAI Error: {transcript.error}"}), 500
        
        # AssemblyAI labels speakers as 'A', 'B', 'C', etc.
        speaker_a_words = []
        speaker_b_words = []
        
        if not transcript.words:
            return jsonify({"error": "AssemblyAI could not transcribe any words."}), 500

        # --- STEP 2: Separate Words by Speaker ---
        for word in transcript.words:
            # Check if word has speaker attribute (some transcripts might not have diarization)
            if hasattr(word, 'speaker'):
                if word.speaker == 'A':
                    speaker_a_words.append(word)
                elif word.speaker == 'B':
                    speaker_b_words.append(word)
            else:
                # If no speaker diarization, treat all as Speaker A
                speaker_a_words.append(word)

        if not speaker_a_words and not speaker_b_words:
            return jsonify({"error": "Diarization failed. Could not assign words to speakers."}), 500
        
        print(f"Transcription complete. Speaker A: {len(speaker_a_words)} words, Speaker B: {len(speaker_b_words)} words")
        
        # Debug: Print first few words to see the structure
        if speaker_a_words:
            print(f"Sample Speaker A word: {speaker_a_words[0]}")
        if speaker_b_words:
            print(f"Sample Speaker B word: {speaker_b_words[0]}")

        # --- STEP 3: Score Both Speakers ---
        score_a = calculate_disfluency_score(speaker_a_words)
        score_b = calculate_disfluency_score(speaker_b_words)
        
        print(f"Speaker A Disfluency Score: {score_a}")
        print(f"Speaker B Disfluency Score: {score_b}")

        # --- STEP 4: Select Target and Analyze ---
        if score_a > score_b or not speaker_b_words:
            target_speaker_id = 'A'
            target_words_list = speaker_a_words
        else:
            target_speaker_id = 'B'
            target_words_list = speaker_b_words
            
        print(f"Targeting Speaker {target_speaker_id} for analysis.")
            
        if not target_words_list:
            return jsonify({
                "analyzed_speaker_id": target_speaker_id,
                "reason": "Target speaker had no discernible words.",
                "feedback": "YOUR SPEECH IS AMAZING"
            }), 200

        # --- STEP 5: Call Gemini for Analysis ---
        analysis_results = get_feedback_for_speaker(target_words_list)
        
        print("Analysis complete.")
        
        # --- STEP 6: Return Final Result ---
        feedback_list = analysis_results.get("feedback", [])
        
        # If no feedback, return positive message
        if not feedback_list:
            feedback_content = "YOUR SPEECH IS AMAZING"
        else:
            feedback_content = feedback_list
        
        final_results = {
            "analyzed_speaker_id": target_speaker_id,
            "reason": f"Speaker {target_speaker_id} had a higher disfluency score.",
            "feedback": feedback_content,
            "scores": {
                "speaker_a": score_a,
                "speaker_b": score_b
            }
        }
        
        return jsonify(final_results), 200

    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500
        
    finally:
        # Clean up: remove the temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            print(f"Cleaned up temporary file: {temp_path}")

# --- 8. Run the App ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n{'='*50}")
    print(f"🚀 Starting Flask server on port {port}...")
    print(f"{'='*50}\n")
    app.run(debug=False, host='0.0.0.0', port=port)
