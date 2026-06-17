# Global Lens

Global Lens is a personalized, AI-driven news aggregator designed to provide marginalized and global-majority contexts to breaking global events. Moving beyond traditional Western-centric wires, Global Lens curates news that illuminates economic equity, pan-African and diaspora ties, and localized structural insights.

## Features

- **Personalized Context Engines**: Adjust context intensity (Balanced, Hyper-Local, or Pan-African) to shift the analytical lens applied to major news.
- **Reading Profiles**: Toggle between a 10-year-old comprehension explainer, high-level executive summaries, or raw news dispatches.
- **Deep Historical Contexts**: Uncover the "how did we get here" backstory for any ongoing situation.
- **Analytics Charts**: Instantly generated visual interpretations of structural statistics relative to breaking news stories.
- **Diaspora Source Injection**: Integrated RSS feeds from Al Jazeera, AllAfrica, and diverse sources.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Backend**: Express + Node.js (with Better SQLite3)
- **AI Processing**: Gemini 2.5 Flash SDK

## Setup & Running

1. Clone and install dependencies: `npm install`
2. Create your `.env` from `.env.example` and add your `GEMINI_API_KEY` and News API keys.
3. Start the dev server: `npm run dev`
4. Access the web interface at `http://localhost:3000`
