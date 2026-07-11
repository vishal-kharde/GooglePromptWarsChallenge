'use strict';

/**
 * Gemini AI service — wraps @google/generative-ai with retry logic,
 * prompt injection hardening, and structured error handling.
 */

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
require('dotenv').config({ override: true });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set. AI features will not work.');
}

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** Safety settings to block harmful content */
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

let _genAI = null;
let _model = null;

function getModel() {
  if (_model) return _model;
  if (!API_KEY) throw new Error('Gemini API key not configured');

  _genAI = new GoogleGenerativeAI(API_KEY);
  _model = _genAI.getGenerativeModel({
    model: MODEL_NAME,
    safetySettings: SAFETY_SETTINGS,
  });
  return _model;
}

/**
 * Sleep utility for retry delays.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates content with retry logic.
 *
 * @param {string} userPrompt
 * @param {string} [systemInstruction]
 * @param {object} [generationConfig]
 * @returns {Promise<string>} Generated text
 */
async function generateContent(userPrompt, systemInstruction = '', generationConfig = {}) {
  const model = getModel();

  const config = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 2048,
    thinkingConfig: {
      thinkingBudget: 0,
    },
    ...generationConfig,
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const modelInstance = systemInstruction
        ? _genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings: SAFETY_SETTINGS, systemInstruction })
        : model;

      const result = await modelInstance.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: config,
      });

      const response = result.response;
      if (!response) throw new Error('Empty response from Gemini');

      const text = response.text();
      if (!text || text.trim() === '') throw new Error('Empty text in Gemini response');

      return text;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Gemini attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`Gemini failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
}

/**
 * Starts a streaming generation and calls onChunk for each text token.
 *
 * @param {Array<{role: string, parts: Array<{text: string}>}>} messages
 * @param {string} systemInstruction
 * @param {Function} onChunk  - called with each text token
 * @returns {Promise<void>}
 */
async function generateStream(messages, systemInstruction, onChunk) {
  const model = systemInstruction
    ? _genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings: SAFETY_SETTINGS, systemInstruction })
    : getModel();

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContentStream({
        contents: messages,
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) onChunk(text);
      }
      return;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Gemini stream attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`Gemini stream failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
}

/**
 * Validates that user input doesn't contain prompt injection patterns.
 * Wraps user input in explicit delimiters before including in prompts.
 *
 * @param {string} userInput
 * @returns {string} Sanitized, delimited user input
 */
function wrapUserInput(userInput) {
  if (typeof userInput !== 'string') return '';
  // Strip any attempts to break out of the user-input section
  const cleaned = userInput
    .replace(/\[SYSTEM\]/gi, '[FILTERED]')
    .replace(/\[INST\]/gi, '[FILTERED]')
    .replace(/ignore previous instructions/gi, '[FILTERED]')
    .replace(/forget.*instructions/gi, '[FILTERED]')
    .trim()
    .slice(0, 2000); // Hard cap

  return `<user_input>${cleaned}</user_input>`;
}

module.exports = { generateContent, generateStream, wrapUserInput };
