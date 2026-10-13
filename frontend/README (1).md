# 🤖 J.A.R.V.I.S Mobile Edition (GrowthOS Telugu)

> *"Until now, J.A.R.V.I.S waited for us. From today… J.A.R.V.I.S starts working for us."*

A complete, step-by-step tutorial series on building a Personal AI Assistant using **JavaScript**, **Gemini API**, **Cloudflare Workers**, and **PWA technologies**. Built entirely on a mobile phone!

![Jarvis Demo GIF](./demo.gif) *(Optional: Add a screen recording gif here)*

## ✨ Features
- 🧠 **AI Brain:** Powered by Google Gemini 1.5 Flash.
- 🎙️ **Voice Control:** Speech Recognition & Text-to-Speech.
- 👁️ **Vision:** Image analysis capabilities.
- 💾 **Memory:** LocalStorage based conversation history.
- 🛠️ **Tools:** Live Weather, News, Crypto APIs.
- 🤖 **Agent Mode:** Autonomous task planning.
- ⚡ **Automation:** Daily Morning Briefing via Telegram Bot (Cloudflare Cron).
- 📱 **PWA:** Installable Android App with "Hey Jarvis" Wake Word.

## 🚀 Quick Start Guide

### Prerequisites
1. A Smartphone (Android recommended for PWA features).
2. Chrome Browser.
3. Free Accounts: GitHub, Google AI Studio (for API Key), Cloudflare, Telegram.

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/vamshi-vfx/Personal-ai-assistant
   cd jarvis-mobile-edition
   
Step 2: Get Your API Keys
1. Gemini API Key: Go to Google AI Studio -> Create API Key.
2. Telegram Bot Token: Search @BotFather on Telegram -> /newbot -> Copy Token.
3. Chat ID: Search @userinfobot on Telegram -> Start -> Copy your ID.

Step 3: Set Up Frontend (GitHub Pages)
1. Upload the frontend folder contents to your GitHub repo.
2. Go to Repo Settings -> Pages -> Deploy from branch (main).
3. Open the generated URL on your phone.
4. Enter your Gemini API Key in the app settings (stored locally in browser).

Step 4: Set Up Automation (Cloudflare Worker)
1. Go to Cloudflare Dashboard -> Workers & Pages.
2. Create a new Worker named jarvis-automation.
3. Paste the code from functions/worker.js (see below) into the editor.
Add Secrets:
Name: TOKEN, Value: [Your Telegram Bot Token]
Name: CHAT_ID, Value: [Your Telegram Chat ID]
4. Go to Triggers -> Add Cron Trigger.
5. Expression: 30 1 * * * (Runs at 7:00 AM IST daily).
6. Deploy.

Step 5: Install as App (PWA)
1. Open your GitHub Pages URL on Chrome (Mobile).
2. Tap the three dots menu -> "Add to Home Screen" or "Install App".
3. Launch the app from your Home Screen. It will run without browser bars!

📂 Project Structure
📦 jarvis-mobile-edition
 ┣ 📂 frontend
  ┣ 📜 index.html       # Main UI + PWA Links
 ┃ ┣ 📜 script.js        # AI Logic + Voice + Tools + Wake Word
 ┃ ┣ 📜 style.css        # Neon Dark Theme
 ┃ ┣ 📜 manifest.json    # PWA Identity Card
 ┃ ┗  assets           # Icons (icon-192.png, icon-512.png)
 ┣ 📂 functions
 ┃ ┗ 📜 worker.js        # Cloudflare Worker Code (Automation)
 ┣ 📜 README.md          # This Documentation
 ┣ 📜 LICENSE            # MIT License
 ┗ 📜 .gitignore         # Ignore sensitive files

 🤝 Contributing
Contributions are welcome! Whether it's fixing bugs, improving the AI prompts, or adding new tools.
1. Fork the repository.
2. Create your Feature Branch (git checkout -b feature/AmazingFeature).
3. Commit your Changes (git commit -m 'Add some AmazingFeature').
4. Push to the Branch (git push origin feature/AmazingFeature).
5. Open a Pull Request.
Please ensure you do NOT commit any sensitive API keys. Use environment variables or local storage securely.

📄 License
Distributed under the MIT License. See LICENSE for more information.

👨‍ Author
Vamshi (vamshi-vfx)
Founder, GrowthOS Telugu

🔗 YouTube Channel : https://youtube.com/@growthos_telugu?si=dtMo5UzAOY9dTEp7

🔗 LinkedIn Profile : https://www.linkedin.com/in/vamsikola-growthos/?isSelfProfile=true

🔗 Instagram Profile : https://www.instagram.com/growth__os/

🔗 Jarvis Mobile & PC Edition Guide : https://vamshi-vfx.github.io/Personal-ai-assistant/frontend/jarvis-build-log.html?menuhide=1790046100#episodes

"Built with ❤️, demonstrating that powerful AI apps can be built with lightweight web stacks accessible to everyone."

🙏 Acknowledgements
1. Google Gemini Team for providing accessible AI APIs.
2. Cloudflare for robust serverless infrastructure.
3. The GrowthOS Family (15K+ Subscribers!) for supporting this journey from Zero to Hero.
