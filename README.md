# Holiday Mystery Generator

A React + Vite app that builds a holiday-themed mystery party game using the OpenAI API.

## Features

- Enter player names and ages; characters are tailored to your group.
- Choose a holiday or occasion (Christmas, New Year, etc.), tone, rounds.
- Generate:
  - Character descriptions and personalities
  - Per-round dialogue lines and clues
  - Inspector segments between rounds
  - Final guessing instructions

## Setup

1. Install dependencies

```sh
npm install
```

2. Configure your OpenAI API key

Create a `.env.local` file in the project root and add:

```sh
VITE_OPENAI_API_KEY=your_api_key_here
```

Alternatively, paste a runtime key in the UI; it’s kept in memory for the session only.

3. Run the dev server

```sh
npm run dev
```

4. Build for production

```sh
npm run build
```
