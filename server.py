# server.py
import os
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import openai

app = Flask(__name__, static_folder="static")
CORS(app)

# Initialize OpenAI API key from environment
openai_api_key = os.environ.get("OPENAI_API_KEY")
if not openai_api_key:
    # Clear, explicit error (indented correctly)
    raise RuntimeError("OPENAI_API_KEY not set in environment")

openai.api_key = openai_api_key

SYSTEM_PROMPT = """
You are a friendly, patient English-speaking coach. When a user speaks, evaluate fluency, major grammar issues, pronunciation problems (if obvious), and give short corrective feedback and a short model answer they can repeat.
Return a compact text reply that includes a JSON blob and a short friendly coaching message.
"""

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/")
def home():
    # Serve static/index.html when visiting root (if you put frontend in /static)
    return app.send_static_file("index.html")

@app.route("/practice", methods=["POST"])
def practice():
    audio = request.files.get("audio")
    if not audio:
        return jsonify({"error": "no audio file provided"}), 400

    tf = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    audio.save(tf.name)

    try:
        # 1) Transcribe - method name depends on openai SDK version; this is the "common" form
        with open(tf.name, "rb") as f:
            transcription = openai.Audio.transcriptions.create(
                model="whisper-1",
                file=f
            )
        user_text = transcription.get("text", "")

        # 2) Ask chat model to evaluate and reply
        user_msg = (f"Student said: \"{user_text}\". Evaluate and return a JSON with keys: "
                    "score, issues, correction, model_answer, explain_short. Also give a 1-2 sentence friendly tip.")

        chat_resp = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg}
            ],
            max_tokens=400
        )

        # Extract assistant text (SDKs vary, keep this defensive)
        assistant_text = None
        if hasattr(chat_resp, "choices"):
            assistant_text = chat_resp.choices[0].message["content"]
        else:
            assistant_text = chat_resp["choices"][0]["message"]["content"]

        return jsonify({
            "transcript": user_text,
            "coach_text": assistant_text
        })

    finally:
        try:
            os.unlink(tf.name)
        except Exception:
            pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
