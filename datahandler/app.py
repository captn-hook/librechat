from flask import Flask
import os
from outlinesr import outlines_routes


app = Flask(__name__)

outlines_routes(app)

@app.route('/')
def explorer():
    return open('index.html').read()

app.run(host='0.0.0.0', port=os.getenv('FLASK_PORT', 5000))