import os
app = Flask(__name__)
CORS(app)


# Init OpenAI client using env var
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
raise RuntimeError("OPENAI_API_KEY not set in environment")


SYSTEM_PROMPT = """
You are a friendly, patient English-speaking coach. When a user speaks, evaluate fluency, major grammar issues, pronunciation problems (if obvious), and give short corrective feedback and a short model answer they can repeat.
Return a compact text reply that includes a JSON blob and a short friendly coaching message.
"""


@app.route("/health")
def health():
return jsonify({"status":"ok"})


@app.route('/practice', methods=['POST'])
def practice():
# Expect multipart form-data with key 'audio'
audio = request.files.get('audio')
if not audio:
return jsonify({'error':'no audio file provided'}), 400


# Save temporarily
tf = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
audio.save(tf.name)


try:
# 1) Transcribe using OpenAI Whisper (speech-to-text)
with open(tf.name, 'rb') as f:
transcription = openai.Audio.transcriptions.create(
model='whisper-1',
file=f
)
user_text = transcription.get('text', '')


# 2) Ask the chat model to evaluate + reply
user_msg = f"Student said: \"{user_text}\". Evaluate and return a JSON with keys: score, issues, correction, model_answer, explain_short. Also give a 1-2 sentence friendly tip."


chat_resp = openai.ChatCompletion.create(
model='gpt-4o-mini',
messages=[
{"role":"system","content":SYSTEM_PROMPT},
{"role":"user","content":user_msg}
],
max_tokens=400
)


assistant_text = chat_resp.choices[0].message['content']


# 3) (Optional) Return response. If you want TTS, call audio.speech.create here.
return jsonify({
'transcript': user_text,
'coach_text': assistant_text
})


finally:
try:
os.unlink(tf.name)
except Exception:
pass


if __name__ == '__main__':
port = int(os.environ.get('PORT', 5000))
app.run(host='0.0.0.0', port=port)
