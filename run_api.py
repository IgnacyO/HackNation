#!/usr/bin/env python
"""
Script to run the Flask API from the project root directory.
This ensures all imports work correctly.
"""
import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the Flask app
from api.app import app

if __name__ == '__main__':
    app.run(debug=True, port=5000)

