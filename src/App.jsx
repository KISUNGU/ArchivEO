import React from 'react';
import Accueil from './components/Accueil';
import { ThemeProvider } from './context/ThemeContext';
import { SessionProvider } from './context/SessionContext';

function App() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <div className="App">
          <Accueil />
        </div>
      </ThemeProvider>
    </SessionProvider>
  );
}

export default App;