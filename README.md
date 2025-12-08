# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

````js
export default defineConfig([
  globalIgnores(['dist']),
  {
    ## Holiday Mystery Generator

    A React + Vite web app that builds a holiday-themed mystery party game using
    the OpenAI API.

    You can:

    - Enter player names and ages so characters can be tailored to your group.
    - Choose a holiday/occasion from a dropdown (Christmas, Halloween, birthdays,
      and more).
    - Choose how many rounds the mystery should have.
    - Generate:
      - Character descriptions (who they are, what they wear, personality).
      - An in-character police inspector who provides extra details between rounds.
      - Per-round lines for each character that gradually reveal clues.
      - A final guessing phase where everyone makes their accusation.

    ### 1. Install dependencies

    ```sh
    npm install
    ```

    ### 2. Configure your OpenAI API key

    Create a `.env.local` file in the project root and add:

    ```sh
    VITE_OPENAI_API_KEY=your_api_key_here
    ```

    Replace `your_api_key_here` with your actual OpenAI key.

    ### 3. Run the dev server

    ```sh
    npm run dev
    ```

    Then open the printed localhost URL (typically `http://localhost:5173`).

    ### 4. Build for production

    ```sh
    npm run build
    ```

    This runs TypeScript type-checking and the Vite build.

    ### Notes

    - The OpenAI client is used in the browser with
      `dangerouslyAllowBrowser: true`. Treat your API key as sensitive and rotate
      it if needed.
    - The generated script is a starting point – feel free to tweak character
      details, costume prompts, and clues to match your group perfectly.
````
