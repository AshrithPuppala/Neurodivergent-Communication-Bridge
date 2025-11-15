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
    genai.configure() 
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
    print("Gemini client initialized successfully.")
except Exception as e:
    print(f"Error initializing Google Gemini client: {e}")
    print("Please make sure your GOOGLE_API_KEY environment variable is set.")

# --- AssemblyAI Client (for Transcription & Diarization) ---
try:
    # This automatically reads the ASSEMBLYAI_API_KEY from your environment
    aai.settings.api_key = os.environ.get("ASSEMBLYAI_API_KEY")
    if aai.settings.api_key is None:
        raise Exception("ASSEMBLYAI_API_KEY not set")
    print("AssemblyAI client initialized successfully.")
except Exception as e:
    print(f"Error initializing AssemblyAI client: {e}")

app = Flask(__name__)

# IMPORTANT: Add CORS to allow frontend to communicate
# Replace the CORS configuration with this:
CORS(app, 
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type"],
     methods=["GET", "POST", "OPTIONS"]
)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
1.  *Whole-Word Repetitions:* (e.g., "I-I-I want to go").
2.  *Blocks / Long Pauses:* (e.g., a long pause before a word, "I want... [2.0 sec pause] ...to go").
3.  *Interjections / Fillers:* (e.g., "I, uh, want to, um, go").
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

# --- 4. Helper Function: Get LLM Feedback (MODIFIED FOR GEMINI) ---
def get_feedback_for_speaker(speaker_words_list):
    """
    Sends a list of words to the FREE Google Gemini API for analysis 
    and returns the feedback JSON.
    """
    if not speaker_words_list:
        return {"feedback": []}
    try:
        # Convert AssemblyAI word objects to a simple format for Gemini
        formatted_list = [
            {"word": word.text, "start": word.start / 1000.0, "end": word.end / 1000.0}
            for word in speaker_words_list
        ]
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

# --- 5. Helper Function: Score Disfluency (MODIFIED FOR ASSEMBLYAI) ---
def calculate_disfluency_score(word_list):
    """
    Calculates a simple disfluency score based on fillers, 
    repetitions, and pauses from AssemblyAI word objects.
    """
    score = 0
    if not word_list:
        return 0
    for i, word in enumerate(word_list):
        # AssemblyAI object uses .text
        clean_word = word.text.lower().strip(".,?!")
        
        if clean_word in FILLER_WORDS:
            score += 1
            
        if i > 0:
            prev_word = word_list[i-1]
            prev_clean_word = prev_word.text.lower().strip(".,?!")
            
            # Repetition
            if clean_word == prev_clean_word and len(clean_word) > 0:
                score += 1
                
            # Long Pause (AssemblyAI timestamps are in milliseconds)
            pause_duration_ms = word.start - prev_word.end
            if pause_duration_ms > 1500: # 1.5 seconds
                score += 1
    return score

# --- 6. The Main Flask Route (MODIFIED FOR ASSEMBLYAI) ---

@app.route('/analyze_conversation', methods=['POST'])
def handle_conversation_analysis():
    
    if 'audio_file' not in request.files:
        return jsonify({"error": "No 'audio_file' part in the request"}), 400

    file = request.files['audio_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filename = f"{int(time.time())}_{file.filename}"
    temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    try:
        file.save(temp_path)
        
        # --- STEP 1: Call AssemblyAI API ---
        # This one API call does BOTH transcription and diarization
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
            if word.speaker == 'A':
                speaker_a_words.append(word)
            elif word.speaker == 'B':
                speaker_b_words.append(word)

        if not speaker_a_words and not speaker_b_words:
             return jsonify({"error": "Diarization failed. Could not assign words to speakers."}), 500
        
        print("Transcription complete. Separating speakers...")

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
            return jsonify({"feedback": "Analysis complete. The target speaker had no discernible words."})

        # --- STEP 5: Call Gemini for Analysis ---
        analysis_results = get_feedback_for_speaker(target_words_list)
        
        print("Analysis complete.")
        
        # --- STEP 6: Return Final Result ---
        final_results = {
            "analyzed_speaker_id": target_speaker_id,
            "reason": f"Speaker {target_speaker_id} had a higher disfluency score.",
            "feedback": analysis_results.get("feedback", [])
        }
        
        return jsonify(final_results), 200

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": f"An server error occurred: {e}"}), 500
        
    finally:
        # Clean up: remove the temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)

# --- 7. Run the App ---
if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
