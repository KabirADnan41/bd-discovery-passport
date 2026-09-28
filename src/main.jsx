import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import GameBoard from './components/game/GameBoard';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameBoard />
  </StrictMode>,
);
