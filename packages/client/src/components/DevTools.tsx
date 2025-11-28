import React, { useState } from 'react';
import { GameStatus, DebugCommand, CardType } from '@sq/shared';

interface DevToolsProps {
  onDebugCommand: (command: DebugCommand) => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ onDebugCommand }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 9999,
          opacity: 0.5,
          fontSize: '12px',
          padding: '4px',
          cursor: 'pointer'
        }}
      >
        🐞 Debug
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      zIndex: 9999,
      maxWidth: '300px',
      boxShadow: '0 0 10px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
        <strong style={{ fontSize: '14px' }}>Developer Tools</strong>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
        >✕</button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#ccc' }}>Force Game Status</label>
            <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => onDebugCommand({ type: 'SET_GAME_STATUS', payload: { status: GameStatus.LOBBY } })}>Lobby</button>
                <button onClick={() => onDebugCommand({ type: 'SET_GAME_STATUS', payload: { status: GameStatus.PLAYING } })}>Playing</button>
                <button onClick={() => onDebugCommand({ type: 'SET_GAME_STATUS', payload: { status: GameStatus.FINISHED } })}>Finished</button>
            </div>
        </div>

        <div style={{ borderTop: '1px solid #555', paddingTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#ccc' }}>Game Control</label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <button onClick={() => onDebugCommand({ type: 'RESET_GAME' })}>Reset Game</button>
                <button onClick={() => onDebugCommand({ type: 'SWITCH_TURN' })}>Switch Turn</button>
            </div>
        </div>

        <div style={{ borderTop: '1px solid #555', paddingTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#ccc' }}>Give Card</label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {Object.values(CardType).map(type => (
                    <button key={type} onClick={() => onDebugCommand({ type: 'GIVE_CARD', payload: { cardType: type } })} style={{ fontSize: '10px' }}>
                        {type}
                    </button>
                ))}
            </div>
        </div>

        <div style={{ borderTop: '1px solid #555', paddingTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#ccc' }}>Queens</label>
            <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => onDebugCommand({ type: 'WAKE_ALL_QUEENS' })}>Wake All</button>
                <button onClick={() => onDebugCommand({ type: 'SLEEP_ALL_QUEENS' })}>Sleep All</button>
            </div>
        </div>
      </div>
    </div>
  );
};

