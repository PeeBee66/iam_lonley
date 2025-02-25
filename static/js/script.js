document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const messageContainer = document.getElementById('messageContainer');
    const usernameForm = document.getElementById('usernameForm');
    const messageForm = document.getElementById('messageForm');
    const usernameInput = document.getElementById('usernameInput');
    const messageInput = document.getElementById('messageInput');
    const setUsernameBtn = document.getElementById('setUsernameBtn');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const statusText = document.getElementById('statusText');
    const usernameDisplay = document.getElementById('usernameDisplay');
    
    // Socket.io connection
    const socket = io();
    let username = '';
    
    // Connect to server
    socket.on('connect', () => {
        showSystemMessage('Connected to server');
        statusText.textContent = 'Connected';
        statusText.style.color = '#43b581';
    });
    
    // Disconnect from server
    socket.on('disconnect', () => {
        showSystemMessage('Disconnected from server');
        statusText.textContent = 'Disconnected';
        statusText.style.color = '#f04747';
    });
    
    // Set username
    setUsernameBtn.addEventListener('click', () => {
        const newUsername = usernameInput.value.trim();
        if (newUsername) {
            socket.emit('set_username', { username: newUsername });
        }
    });
    
    // Username confirmation
    socket.on('username_set', (data) => {
        username = data.username;
        usernameDisplay.textContent = `Username: ${username}`;
        usernameForm.style.display = 'none';
        messageForm.style.display = 'flex';
        showSystemMessage(`You joined as ${username}`);
        messageInput.focus();
    });
    
    // Send message
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit('send_message', { message });
            messageInput.value = '';
        }
    }
    
    // Message sent confirmation
    socket.on('message_sent', (data) => {
        displayMessage(data, 'web-message');
    });
    
    // Receive Discord message
    socket.on('discord_message', (data) => {
        displayMessage(data, 'discord-message');
    });
    
    // Handle errors
    socket.on('error', (data) => {
        showSystemMessage(`Error: ${data.message}`);
    });
    
    // Display message in chat
    function displayMessage(data, messageClass) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageClass}`;
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        
        if (data.avatar_url) {
            const avatar = document.createElement('img');
            avatar.className = 'avatar';
            avatar.src = data.avatar_url;
            headerDiv.appendChild(avatar);
        }
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = data.username;
        headerDiv.appendChild(usernameSpan);
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        
        // Format timestamp if it exists
        if (data.timestamp) {
            const date = new Date(data.timestamp);
            timestampSpan.textContent = formatTime(date);
        } else {
            timestampSpan.textContent = formatTime(new Date());
        }
        
        headerDiv.appendChild(timestampSpan);
        messageDiv.appendChild(headerDiv);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = data.content;
        messageDiv.appendChild(contentDiv);
        
        messageContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // Display system message
    function showSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.textContent = message;
        messageContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // Format time for display
    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Scroll to bottom of message container
    function scrollToBottom() {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
});