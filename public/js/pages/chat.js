/**
 * AI Chat page — multilingual streaming chat with Google Gemini.
 */

import { api, readSSEStream } from '../api.js';
import { state, appendChatMessage, clearChatHistory } from '../state.js';
import { escapeText, markdownToSafeHtml } from '../utils/sanitize.js';
import { getLanguageOptions } from '../utils/i18n.js';

let _isStreaming = false;

export function renderChat() {
  document.getElementById('page-title').textContent = 'AI Assistant';
  const profile = state.profile;
  const history = state.chatHistory;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>🤖 Multilingual AI Assistant</h1>
      <p>Ask anything about monsoon safety — in your language. Powered by Google Gemini.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:1.5rem;height:calc(100vh - 280px);min-height:500px">

      <!-- Chat Window -->
      <div class="card" style="padding:0;display:flex;flex-direction:column;overflow:hidden">

        <!-- Chat Header -->
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-shrink:0">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <div class="chat-avatar ai" style="width:36px;height:36px;font-size:1rem">🤖</div>
            <div>
              <div style="font-weight:600;font-size:0.9rem">MonsoonGuard AI</div>
              <div style="font-size:0.7rem;color:var(--color-success);display:flex;align-items:center;gap:4px">
                <span style="width:6px;height:6px;border-radius:50%;background:var(--color-success);display:inline-block"></span>
                Online · Powered by Gemini
              </div>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <select id="chat-language" class="form-select" style="width:auto;font-size:0.775rem;padding:0.4rem 2rem 0.4rem 0.75rem"
                    aria-label="Select language">
              ${getLanguageOptions(profile.language)}
            </select>
            <button class="btn btn-ghost btn-sm btn-icon" id="clear-chat-btn" aria-label="Clear chat history" title="Clear chat">
              🗑️
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div class="chat-messages" id="chat-messages" style="flex:1;overflow-y:auto" role="log" aria-live="polite" aria-label="Chat messages">
          ${history.length === 0 ? renderWelcomeMessage(profile.language) : history.map(m => renderMessage(m)).join('')}
        </div>

        <!-- Input -->
        <div style="padding:1rem 1.25rem;border-top:1px solid var(--color-border);flex-shrink:0">
          <div style="display:flex;gap:0.75rem;align-items:flex-end">
            <textarea
              id="chat-input"
              class="form-textarea"
              style="min-height:52px;max-height:120px;resize:none;flex:1;margin:0"
              placeholder="Ask about monsoon safety, evacuation, emergency kits... (Enter to send)"
              rows="1"
              aria-label="Chat message input"
              maxlength="1000"
            ></textarea>
            <button class="btn btn-primary" id="chat-send-btn" aria-label="Send message" style="flex-shrink:0;height:52px">
              <span class="btn-text">➤ Send</span>
            </button>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.5rem">
            Press Enter to send, Shift+Enter for new line · Max 1000 characters
          </div>
        </div>
      </div>

      <!-- Quick Actions Sidebar -->
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="card card-sm">
          <div class="card-title" style="margin-bottom:0.75rem;font-size:0.875rem">⚡ Quick Questions</div>
          <div style="display:flex;flex-direction:column;gap:0.4rem" id="quick-actions-list">
            <div class="skeleton" style="height:2rem;border-radius:2rem"></div>
            <div class="skeleton" style="height:2rem;border-radius:2rem;margin-top:4px"></div>
            <div class="skeleton" style="height:2rem;border-radius:2rem;margin-top:4px"></div>
          </div>
        </div>

        <div class="card card-sm">
          <div class="card-title" style="margin-bottom:0.75rem;font-size:0.875rem">🚨 Emergency Numbers</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.5rem">
            <a href="tel:112" style="color:var(--color-danger);font-weight:600">📞 112 — National Emergency</a>
            <a href="tel:1800-180-1717" style="color:var(--text-secondary)">🌩️ IMD Weather Helpline</a>
            <a href="tel:011-24363260" style="color:var(--text-secondary)">🚁 NDRF Control Room</a>
            <a href="tel:1070" style="color:var(--text-secondary)">🏛️ State Disaster Helpline</a>
            <a href="tel:1800-120-9771" style="color:var(--text-secondary)">🌊 Flood Helpline</a>
          </div>
        </div>

        <div class="card card-sm card-accent">
          <div style="font-size:0.8rem;color:var(--text-secondary)">
            <strong style="color:var(--color-accent)">💡 Tip:</strong> You can ask me in Hindi, Bengali, Tamil, or any of 14 Indian languages!
          </div>
        </div>
      </div>
    </div>
  `;

  // Load quick actions
  loadQuickActions(profile.language);

  // Scroll to bottom
  scrollToBottom();

  // Bind events
  const sendBtn  = document.getElementById('chat-send-btn');
  const inputEl  = document.getElementById('chat-input');
  const clearBtn = document.getElementById('clear-chat-btn');

  sendBtn.addEventListener('click', handleSend);
  clearBtn.addEventListener('click', () => {
    clearChatHistory();
    renderChat();
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });
}

function renderWelcomeMessage(language) {
  const WELCOME = {
    English:  'Namaste! 🙏 I\'m MonsoonGuard AI. Ask me anything about monsoon safety, emergency preparedness, travel advisories, or what to do in a flood. I can help in Hindi, Bengali, Tamil, and 14 Indian languages.',
    Hindi:    'नमस्ते! 🙏 मैं MonsoonGuard AI हूँ। बाढ़, तूफान या मानसून से जुड़े किसी भी सवाल के लिए मुझसे पूछें।',
    Bengali:  'নমস্কার! 🙏 আমি MonsoonGuard AI। বন্যা, ঝড় বা বর্ষা সম্পর্কে যেকোনো প্রশ্ন করুন।',
  };
  const content = WELCOME[language] || WELCOME.English;

  return `
    <div class="chat-message ai" style="margin-bottom:0" aria-label="AI welcome message">
      <div class="chat-avatar ai" aria-hidden="true">🤖</div>
      <div>
        <div class="chat-bubble">${escapeText(content)}</div>
        <div class="chat-time">${new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  `;
}

function renderMessage(msg) {
  const isAI = msg.role === 'assistant';
  const time  = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';

  if (isAI) {
    // Render AI message with safe markdown
    return `
      <div class="chat-message ai" aria-label="AI response">
        <div class="chat-avatar ai" aria-hidden="true">🤖</div>
        <div style="max-width:85%">
          <div class="chat-bubble markdown-content">${markdownToSafeHtml(msg.content)}</div>
          <div class="chat-time">${escapeText(time)}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="chat-message user" aria-label="Your message">
      <div class="chat-avatar user" aria-hidden="true">👤</div>
      <div>
        <div class="chat-bubble">${escapeText(msg.content)}</div>
        <div class="chat-time">${escapeText(time)}</div>
      </div>
    </div>
  `;
}

async function loadQuickActions(language) {
  const list = document.getElementById('quick-actions-list');
  if (!list) return;

  try {
    const { actions } = await api.ai.quickActions(language);
    list.innerHTML = actions.slice(0, 6).map(action => `
      <button class="chip" style="text-align:left;white-space:normal;height:auto;padding:0.4rem 0.75rem"
              onclick="document.getElementById('chat-input').value=${JSON.stringify(action)};document.getElementById('chat-send-btn').click()">
        ${escapeText(action)}
      </button>
    `).join('');
  } catch (e) {
    list.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted)">Could not load suggestions.</p>';
  }
}

async function handleSend() {
  if (_isStreaming) return;

  const inputEl  = document.getElementById('chat-input');
  const sendBtn  = document.getElementById('chat-send-btn');
  const language = document.getElementById('chat-language')?.value || state.profile.language;

  const message = inputEl.value.trim();
  if (!message) return;

  // Append user message to UI
  appendUserMessage(message);
  appendChatMessage({ role: 'user', content: message });

  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;
  _isStreaming = true;

  // Show typing indicator
  const typingId = showTypingIndicator();

  try {
    // Build history for context (last 10 turns)
    const history = state.chatHistory.slice(-10, -1).map(m => ({
      role:    m.role,
      content: m.content,
    }));

    const res = await api.ai.chat(message, history, language, state.profile.city);

    // Remove typing indicator, create streaming bubble
    removeTypingIndicator(typingId);
    const { bubbleEl, textNode } = appendStreamingBubble();

    let fullText = '';

    await readSSEStream(
      res,
      (chunk) => {
        fullText += chunk;
        // Update bubble with safe markdown during streaming
        bubbleEl.innerHTML = markdownToSafeHtml(fullText);
        scrollToBottom();
      },
      () => {
        appendChatMessage({ role: 'assistant', content: fullText });
      },
      (err) => {
        bubbleEl.textContent = '❌ ' + err.message;
        showToast('error', 'Chat Error', err.message);
      }
    );
  } catch (err) {
    removeTypingIndicator(typingId);
    appendErrorMessage(err.message);
    showToast('error', 'Chat Error', err.message);
  } finally {
    sendBtn.disabled = false;
    _isStreaming = false;
    inputEl.focus();
  }
}

function appendUserMessage(text) {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;

  const div = document.createElement('div');
  div.className = 'chat-message user';
  div.setAttribute('aria-label', 'Your message');
  div.innerHTML = `
    <div class="chat-avatar user" aria-hidden="true">👤</div>
    <div>
      <div class="chat-bubble">${escapeText(text)}</div>
      <div class="chat-time">${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  messages.appendChild(div);
  scrollToBottom();
}

function showTypingIndicator() {
  const messages = document.getElementById('chat-messages');
  if (!messages) return null;

  const id  = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'chat-message ai';
  div.id = id;
  div.innerHTML = `
    <div class="chat-avatar ai" aria-hidden="true">🤖</div>
    <div class="chat-bubble" style="padding:0.5rem 0.75rem">
      <div class="typing-dots" aria-label="AI is typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messages.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  if (id) document.getElementById(id)?.remove();
}

function appendStreamingBubble() {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message ai';
  div.setAttribute('aria-label', 'AI response');
  div.innerHTML = `
    <div class="chat-avatar ai" aria-hidden="true">🤖</div>
    <div style="max-width:85%">
      <div class="chat-bubble markdown-content"></div>
      <div class="chat-time">${new Date().toLocaleTimeString()}</div>
    </div>
  `;
  messages.appendChild(div);
  const bubbleEl = div.querySelector('.chat-bubble');
  scrollToBottom();
  return { bubbleEl };
}

function appendErrorMessage(msg) {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = 'chat-message ai';
  div.innerHTML = `
    <div class="chat-avatar ai" aria-hidden="true">🤖</div>
    <div class="chat-bubble" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.2)">
      ❌ ${escapeText(msg)}. Please try again.
    </div>
  `;
  messages.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const messages = document.getElementById('chat-messages');
  if (messages) {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }
}
