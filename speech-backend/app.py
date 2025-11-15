from flask import Flask, request, jsonify
from flask_cors import CORS
import os
# ... rest of your imports

app = Flask(__name__)

# Add CORS - IMPORTANT!
CORS(app, origins=[
    'https://neurodivergent-communication-bridge-5pfw.onrender.com',  # Your existing frontend
    'http://localhost:3000'  # For local development
])

# ... rest of your existing code
