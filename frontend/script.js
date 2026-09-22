Update my existing J.A.R.V.I.S personal AI assistant.

IMPORTANT: Do not change the existing futuristic black-and-cyan design, layout, animations, or overall user interface. Preserve the current visual style exactly.

1. REAL WEB SEARCH (GOOGLE SEARCH GROUNDING)
- Enable the official Gemini API Google Search tool (google_search).
- Make real web searches when the user asks for current or online information.
- Never fabricate search results, sources, website titles, or URLs.
- Use the grounding metadata returned by the Gemini API to extract genuine search sources.
- Display real, clickable website titles and URLs in the search results section.
- Keep normal chat responses working as they currently do.

2. SEARCH RESULTS PANEL
- Create a separate SEARCH RESULTS panel that appears when web search is used.
- Use the existing futuristic cyan glowing design.
- Add a cyan border, subtle glow, rounded corners, and mobile-friendly spacing.
- Display:
  • Search status
  • AI-generated answer
  • Genuine website titles
  • Clickable source links
- Open source links safely in a new browser tab.
- Do not show fake sources or invented URLs.
- If no verified sources are returned, clearly indicate that sources are unavailable.

3. GEMINI API INTEGRATION
- Update the existing Gemini API request to support Google Search grounding.
- Correctly parse the API's groundingMetadata.
- Extract source titles and URLs from groundingChunks.
- Keep the AI answer separate from the source list.
- Handle API errors, quota limits, invalid API keys, and unavailable search gracefully.
- Do not break the existing API key input and localStorage functionality.

4. HTML AND SECURITY
- Never display raw HTML tags as plain text.
- Use actual DOM elements created with document.createElement() or safe HTML rendering.
- Use textContent for user-generated text.
- Validate and safely handle source URLs before making them clickable.
- Do not introduce XSS vulnerabilities.

5. PRESERVE EXISTING FEATURES
Do not break any existing functionality:
- Microphone / voice input
- Text-to-speech
- Memory system
- Camera / image analysis
- Chat history
- Clear chat button
- API key input
- Existing model fallback system
- Current J.A.R.V.I.S futuristic UI

6. RESPONSIVE DESIGN
- Ensure the new SEARCH RESULTS panel works smoothly on Android mobile screens.
- Maintain the existing black-and-cyan theme.
- Avoid horizontal scrolling and layout overflow.
- Use readable typography and appropriate spacing.

7. TESTING
- Test normal chat without web search.
- Test real web search with current information.
- Test clickable source links.
- Test invalid API keys and API errors.
- Test microphone, memory, and camera features after the update.
- Ensure no existing functionality is removed or replaced unnecessarily.

IMPORTANT:
Return the complete updated HTML, CSS, and JavaScript code.
Do not provide a mockup or incomplete implementation.
Preserve all existing functionality and make the web search feature fully operational.
