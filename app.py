import os
import json
import requests
from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, emit, join_room
import discord
from discord.ext import commands
import threading
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app, cors_allowed_origins="*")

# Load settings from JSON
def load_settings():
    try:
        with open('settings.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        # Default settings if file doesn't exist
        return {
            "webhook_url": "",
            "bot_token": "",
            "channel_id": 0,
            "server_name": "Loneliness Talking Device"
        }

settings = load_settings()

# Discord bot setup
intents = discord.Intents.default()
intents.messages = True
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# Store active web clients
active_clients = {}
discord_messages_cache = []
MAX_CACHE_SIZE = 100

@bot.event
async def on_ready():
    print(f'Bot is ready: {bot.user}')

@bot.event
async def on_message(message):
    # Ignore messages from the bot itself
    if message.author == bot.user:
        return
    
    # Check if the message is from the target channel
    if message.channel.id == settings['channel_id']:
        msg_data = {
            'username': message.author.name,
            'content': message.content,
            'timestamp': str(message.created_at),
            'avatar_url': str(message.author.avatar.url) if message.author.avatar else ""
        }
        
        # Add to cache
        discord_messages_cache.append(msg_data)
        if len(discord_messages_cache) > MAX_CACHE_SIZE:
            discord_messages_cache.pop(0)
        
        # Relay to web clients
        socketio.emit('discord_message', msg_data)

# Start bot in a separate thread
def run_discord_bot():
    bot.run(settings['bot_token'])

# Routes
@app.route('/')
def index():
    return render_template('index.html', server_name=settings['server_name'])

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    # Send cached messages to new client
    for msg in discord_messages_cache:
        emit('discord_message', msg)

@socketio.on('disconnect')
def handle_disconnect():
    # Remove client from active clients
    if request.sid in active_clients:
        del active_clients[request.sid]
    print(f'Client disconnected: {request.sid}')

@socketio.on('set_username')
def handle_username(data):
    username = data.get('username', 'Anonymous')
    active_clients[request.sid] = username
    emit('username_set', {'username': username})

@socketio.on('send_message')
def handle_message(data):
    if request.sid not in active_clients:
        emit('error', {'message': 'Please set a username first'})
        return
    
    username = active_clients[request.sid]
    content = data.get('message', '').strip()
    
    if not content:
        return
    
    # Send to Discord via webhook
    webhook_data = {
        'content': content,
        'username': f"Web User: {username}"
    }
    
    try:
        requests.post(settings['webhook_url'], json=webhook_data)
        
        # Emit back to sender for confirmation
        emit('message_sent', {
            'username': username,
            'content': content,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        emit('error', {'message': f'Failed to send message: {str(e)}'})

# For Gunicorn compatibility
application = app

# Only start the bot thread when running directly (not with Gunicorn)
if __name__ == '__main__':
    # Start Discord bot in a separate thread
    if settings['bot_token']:
        bot_thread = threading.Thread(target=run_discord_bot)
        bot_thread.daemon = True
        bot_thread.start()
    
    # Start Flask app
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)