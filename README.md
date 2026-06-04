NERD_JOURNAL_

Nerd Journal is a personal journaling and Personal Knowledge Management (PKM) application designed for developers, hackers, and privacy enthusiasts. It offers a seamless writing experience powered by Artificial Intelligence, all wrapped in a brutalist, minimalist interface inspired by old green-phosphor terminals.

The application is strictly Serverless, Client-Centric, and Zero-Knowledge. There is no central database: your thoughts are yours, your keys are yours, your cloud is yours.

🔒 The Three Core Pillars
Zero-Knowledge Encryption (Client-Side): Data never leaves the device in plain text. Every note, text entry, or voice recording is encrypted locally in AES-GCM using a key derived (PBKDF2) from a complex Master Password.

BYOK (Bring Your Own Key): No subscriptions, no proxy servers. The app interfaces directly with Google Gemini APIs using the personal API key provided by the user.

BYO-Cloud (Bring Your Own Cloud): No corporate lock-in. Encrypted data can be synchronized exclusively on the cloud providers chosen by the user (Google Drive, iCloud, WebDAV).

💻 Main Features
Terminal/Cyberpunk Interface: Strictly squared UI (border-radius: 0), abyssal backgrounds, monospace fonts, neon green accents, and ASCII icons. Zero distractions, total focus on content.

Gemini-Native Integration: Exclusive support for the Google Gemini ecosystem, featuring dynamic model selection (with gemini-3.1-flash-lite set as the default engine for speed and efficiency).

Auto-Tagging & Semantic Analysis: AI analyzes the inserted logs to generate contextual tags, quick bullet-point summaries, and color palettes to visually organize the journal.

Second Brain (RAG): Retrieval-Augmented Generation capabilities that allow you to "chat" with your past notes and extract insights.

Voice Transcription: Client-side/API-driven audio processing to convert spoken thoughts into structured text logs.
