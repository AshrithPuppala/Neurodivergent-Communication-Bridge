from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    'https://your-frontend.onrender.com',
    'http://localhost:3000'
])
