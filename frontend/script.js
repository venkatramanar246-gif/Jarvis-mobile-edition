
const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendButton = document.getElementById('send');

function add(text, who = '') {
  const d = document.createElement('div');

  d.className = `msg ${who}`.trim();
  d.textContent = text;

  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

function sendMessage() {
  const t = input.value.trim();

  if (!t) {
    return;
  }

  add(`YOU: ${t}`, 'user');

  input.value = '';

  add('J.A.R.V.I.S: Processing...', 'ai');

  setTimeout(() => {
    add(
      'J.A.R.V.I.S: Systems online. How may I assist you, Boss?',
      'ai'
    );
  }, 1000);
}

sendButton.addEventListener('click', sendMessage);

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});
