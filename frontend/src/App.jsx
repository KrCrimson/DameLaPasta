import { io } from 'socket.io-client';
import { useState, useEffect } from 'react';
import Board from './components/Board';

// URL for WebSockets. Default to localhost port 4000
const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000', {
  autoConnect: false
});

function App() {
  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem('sessionId');
    if (!id) {
       id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
       sessionStorage.setItem('sessionId', id);
    }
    return id;
  });

  const [view, setView] = useState('welcome'); // welcome, lobby, playing
  const [role, setRole] = useState(null); // 'host', 'player'
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomState, setRoomState] = useState(null);

  // Estados de la Modál 
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [buzzedPlayerInfo, setBuzzedPlayerInfo] = useState(null);
  
  const [categories, setCategories] = useState([]);
  
  useEffect(() => {
    // 1. Cargar categorías de la base de datos Supabase a través del Backend
    const fetchCategories = async () => {
       try {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/categories`);
          const data = await res.json();
          if (data.success) {
             // Mezclamos aleatoriamente TODAS las categorías que mande la BD
             const shuffledCategories = data.categories.sort(() => 0.5 - Math.random());
             // Limitamos a un máximo para que no se apriete infinito el diseño (ej. 10 columnas)
             const selectedCategories = shuffledCategories.slice(0, 10);
             
             // Aseguramos que las preguntas estén ordenadas por puntos (200 a 1000)
             selectedCategories.forEach(cat => {
                 cat.questions.sort((a, b) => a.points - b.points);
             });
             
             setCategories(selectedCategories);
             // Si el host se recarga, tratamos de restaurar las marcadas de sessionStorage
             const savedCats = sessionStorage.getItem('categoriesState');
             if (savedCats) {
                 setCategories(JSON.parse(savedCats));
             }
          }
       } catch (error) {
          console.error("Error cargando categorías:", error);
       }
    };
    fetchCategories();

    // 2. Iniciar conexión WebSockets
    socket.connect();
    
    // 3. Intento de reconexión automática si la sesión sobrevive
    socket.on('connect', () => {
      const gameData = JSON.parse(sessionStorage.getItem('gameData'));
      if (gameData && gameData.roomCode) {
        if (gameData.role === 'host') {
          socket.emit('reconnectHost', { roomCode: gameData.roomCode, sessionId }, (res) => {
            if (res.success) {
              setRole('host');
              setRoomCode(gameData.roomCode);
              setRoomState(res.roomState);
              if (res.roomState.state === 'playing') setView('playing');
              else setView('lobby');
              if (res.roomState.currentQuestion) setActiveQuestion(res.roomState.currentQuestion);
            } else {
              sessionStorage.removeItem('gameData');
            }
          });
        } else if (gameData.role === 'player') {
          socket.emit('joinRoom', { roomCode: gameData.roomCode, playerName: gameData.playerName, sessionId }, (res) => {
            if (res.success) {
              setRole('player');
              setPlayerName(gameData.playerName);
              setRoomCode(gameData.roomCode);
              setRoomState(res.roomState);
              if (res.roomState.state === 'playing') setView('playing');
              else setView('lobby');
              if (res.roomState.currentQuestion) setActiveQuestion(res.roomState.currentQuestion);
            } else {
              sessionStorage.removeItem('gameData');
            }
          });
        }
      }
    });

    socket.on('roomCreated', (data) => {
      setRoomCode(data.roomCode);
      setRoomState(data.roomState);
      setView('lobby');
    });
    
    socket.on('playerJoined', (data) => {
      setRoomState(prev => ({...prev, players: data.players}));
    });
    
    socket.on('gameStarted', (data) => {
      setRoomState(prev => ({...prev, state: data.state}));
      setView('playing');
    });

    socket.on('questionSelected', (data) => {
      setActiveQuestion(data.question);
      setBuzzedPlayerInfo(null);
    });
    
    socket.on('playerBuzzed', (data) => {
      setBuzzedPlayerInfo(data);
    });

    socket.on('answerResult', (data) => {
      setRoomState(prev => ({...prev, players: data.players}));
      // Cerrar la pregunta independientemente de si es correcta o no, tal como se solicitó
      setActiveQuestion(null);
      setBuzzedPlayerInfo(null);
    });

    socket.on('buzzersReset', () => {
      setBuzzedPlayerInfo(null);
    });

    socket.on('playerLeft', (data) => {
      setRoomState(prev => ({...prev, players: data.players}));
    });

    socket.on('roomClosed', () => {
      leaveRoom();
      alert('La sala fue cerrada por el anfitrión.');
    });

    return () => {
      socket.off('connect');
      socket.off('roomCreated');
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('questionSelected');
      socket.off('playerBuzzed');
      socket.off('answerResult');
      socket.off('buzzersReset');
      socket.off('playerLeft');
      socket.off('roomClosed');
    };
  }, [sessionId]);

  const createRoom = () => {
    setRole('host');
    socket.emit('createRoom', { hostName: 'Host Principal', sessionId }, (res) => {
      if (res.success) {
        setRoomCode(res.roomCode);
        setRoomState(res.roomState);
        setView('lobby');
        sessionStorage.setItem('gameData', JSON.stringify({ role: 'host', roomCode: res.roomCode }));
      }
    });
  };

  const joinRoom = () => {
    if (!roomCode || !playerName) return alert("Llena los campos");
    setRole('player');
    socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), playerName, sessionId }, (res) => {
      if (res.success) {
         setRoomState(res.roomState);
         setView('lobby');
         sessionStorage.setItem('gameData', JSON.stringify({ role: 'player', roomCode: roomCode.toUpperCase(), playerName }));
      } else {
         alert(res.message);
      }
    });
  };

  const startGame = () => {
    socket.emit('startGame', { roomCode, sessionId });
  };
  
  const buzz = () => {
    socket.emit('buzz', { roomCode, sessionId });
  };

  const leaveRoom = () => {
    socket.disconnect();
    setTimeout(() => socket.connect(), 100);
    setView('welcome');
    setRoomCode('');
    setPlayerName('');
    setRole(null);
    setRoomState(null);
    sessionStorage.removeItem('gameData');
    sessionStorage.removeItem('categoriesState');
    
    // Restauramos el estado de las preguntas a no respondidas
    setCategories(prev => prev.map(c => ({
      ...c,
      questions: c.questions.map(q => ({ ...q, isAnswered: false }))
    })));
  };

  const handleQuestionSelect = (cat, question) => {
    if (role === 'host') {
       const updatedCats = categories.map(c => {
         if (c.name === cat.name) {
           return {
             ...c,
             questions: c.questions.map(q => q.points === question.points ? { ...q, isAnswered: true } : q)
           };
         }
         return c;
       });
       setCategories(updatedCats);
       sessionStorage.setItem('categoriesState', JSON.stringify(updatedCats)); // Save state to survive host reload
       socket.emit('selectQuestion', { roomCode, category: cat.name, points: question.points, text: question.question, answer: question.answer, sessionId });
    }
  };

  const evaluateAnswer = (isCorrect) => {
    socket.emit('evaluateAnswer', { roomCode, isCorrect, sessionId });
  };

  const closeQuestionWithoutAnswer = () => {
    socket.emit('resetBuzzer', { roomCode, sessionId });
    setActiveQuestion(null);
  };

  const myPlayer = roomState?.players?.find(p => p.sessionId === sessionId);

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4 overflow-hidden relative'>
      
      {/* Background glow effects - Softer colors */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-900/20 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-900/20 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Navegación Top Bar: Botón de regresar */}
      {view !== 'welcome' && (
        <div className="absolute top-6 left-6 z-20">
           <button 
             onClick={leaveRoom}
             className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 font-bold transition flex items-center shadow-md">
             ← Salir de la Sala
           </button>
        </div>
      )}

      {/* MODAL DE PREGUNTA */}
      {activeQuestion && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-slate-900 border-2 border-sky-400/50 p-8 md:p-12 rounded-3xl shadow-xl max-w-4xl w-full text-center relative flex flex-col items-center">
              
              <h2 className="text-3xl text-amber-300 font-bold mb-2 uppercase">{activeQuestion.category}</h2>
              <h1 className="text-6xl text-sky-400 font-black drop-shadow-md mb-8" style={{ fontFamily: 'impact, sans-serif' }}>
                 {activeQuestion.points}
              </h1>

              {role === 'host' && (
                 <div className="bg-slate-800/80 p-6 rounded-xl border border-sky-500/30 w-full mb-8">
                     <p className="text-slate-400 mb-2">Pregunta:</p>
                     <p className="text-2xl font-bold text-slate-100 mb-4">{activeQuestion.text || 'Sin texto de pregunta...'}</p>
                     <p className="text-slate-400 mb-2">Respuesta Correcta:</p>
                     <p className="text-3xl font-black text-emerald-400">{activeQuestion.answer || 'Sin respuesta guardada...'}</p>
                 </div>
              )}

              {buzzedPlayerInfo ? (
                 <div className="animate-pulse bg-rose-950/50 border-2 border-rose-500/50 p-6 rounded-2xl mb-8 w-full shadow-lg shadow-rose-900/20">
                     <h3 className="text-2xl mb-2 text-rose-200">¡Tiempo Detenido!</h3>
                     <p className="text-5xl font-black text-rose-400 drop-shadow-md" style={{ fontFamily: 'impact, sans-serif' }}>
                         {buzzedPlayerInfo.playerName || 'UN JUGADOR'}
                     </p>
                     <p className="text-xl mt-2 text-rose-100">tiene la palabra...</p>
                 </div>
              ) : (
                 <div className="mb-8 flex flex-col items-center">
                    <p className="text-2xl text-sky-200 animate-pulse mb-6">Esperando a que alguien pulse el botón...</p>
                    {role === 'player' && (
                      <button 
                         onClick={buzz}
                         className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 active:scale-95 transition-all text-white font-black text-4xl border-8 border-rose-800 shadow-[0_0_50px_rgba(225,29,72,0.5)] flex items-center justify-center"
                         style={{ fontFamily: 'impact, sans-serif' }}>
                         ¡PULSA!
                      </button>
                    )}
                 </div>
              )}

              {role === 'host' && (
                 <div className="flex flex-wrap gap-4 justify-center w-full mt-4">
                    <button 
                       disabled={!buzzedPlayerInfo}
                       onClick={() => evaluateAnswer(true)}
                       className={`px-8 py-4 font-bold text-xl rounded-xl border-2 transition-all ${buzzedPlayerInfo ? 'bg-emerald-600/80 hover:bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}>
                       CORRECTO (+{activeQuestion.points})
                    </button>
                    <button 
                       disabled={!buzzedPlayerInfo}
                       onClick={() => evaluateAnswer(false)}
                       className={`px-8 py-4 font-bold text-xl rounded-xl border-2 transition-all ${buzzedPlayerInfo ? 'bg-rose-600/80 hover:bg-rose-500 border-rose-400 text-white shadow-md shadow-rose-600/30' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}>
                       INCORRECTO (-{activeQuestion.points})
                    </button>
                 </div>
              )}

              {role === 'host' && (
                  <button 
                     onClick={closeQuestionWithoutAnswer}
                     className="mt-6 px-6 py-2 bg-slate-800 text-slate-300 hover:text-slate-100 rounded-lg border border-slate-600 transition">
                     Cancelar pregunta
                  </button>
              )}
           </div>
        </div>
      )}

      <div className="z-10 w-full flex flex-col items-center">
        {view === 'welcome' && (
          <>
            <h1 className='text-6xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-b from-sky-300 to-sky-500 drop-shadow-lg mb-12 text-center leading-tight' 
                style={{ fontFamily: 'impact, sans-serif' }}>
              DAME LA PASTA
            </h1>
            
            <div className='flex flex-col gap-6 w-full max-w-sm'>
              <button 
                onClick={createRoom}
                className='w-full px-8 py-5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-2xl md:text-3xl rounded-xl border-[3px] border-amber-300 shadow-md shadow-amber-500/20 transition-all transform hover:-translate-y-1 active:scale-95 text-center'>
                Crear Sala
              </button>
              
              <div className="h-px bg-sky-400/20 w-full my-4 relative">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-4 font-semibold text-sky-400 text-sm">O ÚNETE</span>
              </div>
              
              <input 
                type="text" 
                placeholder="Tu Nombre" 
                value={playerName}
                onChange={e => setPlayerName(e.target.value.toUpperCase())}
                className='w-full px-4 py-4 bg-slate-800/80 text-white placeholder-slate-400 text-xl font-semibold text-center border-2 border-slate-600 rounded-xl focus:border-sky-400 focus:outline-none focus:shadow-md focus:shadow-sky-400/20 transition'
              />
              <input 
                type="text" 
                placeholder="Código de Sala" 
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className='w-full px-4 py-4 bg-slate-800/80 text-white placeholder-slate-400 text-xl font-bold text-center border-2 border-slate-600 rounded-xl focus:border-sky-400 focus:outline-none focus:shadow-md focus:shadow-sky-400/20 tracking-[.25em] transition'
              />
              <button 
                onClick={joinRoom}
                className='w-full px-8 py-5 bg-transparent hover:bg-slate-800 text-sky-300 font-bold text-2xl md:text-3xl rounded-xl border-[3px] border-sky-400/50 shadow-md shadow-sky-500/10 transition-all transform hover:-translate-y-1 active:scale-95 text-center'>
                Unirse
              </button>
            </div>
          </>
        )}

        {view === 'lobby' && roomState && (
          <div className="flex flex-col items-center bg-slate-800/50 p-8 rounded-3xl border border-sky-500/20 shadow-lg relative">
            <h2 className="text-amber-300 text-3xl mb-4 font-black" style={{ fontFamily: 'impact, sans-serif' }}>
              CÓDIGO DE SALA:
            </h2>
            <div className="bg-slate-900/80 px-8 py-4 rounded-xl border-2 border-dashed border-sky-400/50 mb-8">
              <h1 className="text-6xl text-sky-400 font-bold tracking-widest">{roomCode}</h1>
            </div>
            
            <h3 className="text-xl font-bold mb-4 text-sky-200">Jugadores ({roomState.players.length}/10)</h3>
            <ul className="grid grid-cols-2 gap-4 w-full mb-8">
              {roomState.players.map((p, i) => (
                <li key={i} className="bg-slate-700/50 px-4 py-3 rounded-lg text-center font-semibold text-lg border border-slate-600 transition">
                    <span className={p.id === socket.id ? 'text-amber-300' : 'text-slate-200'}>
                        {p.name || 'Host'} {p.id === socket.id ? '(Tú)' : ''}
                    </span>
                    {p.name !== 'Host' && <span className="ml-2 text-sky-400">${p.score}</span>}
                </li>
              ))}
            </ul>

            {role === 'host' ? (
              <button onClick={startGame} className='px-10 py-4 bg-sky-500 hover:bg-sky-400 text-slate-900 font-black text-2xl rounded-xl shadow-md shadow-sky-500/30 transition-all transform hover:-translate-y-1'>EMPEZAR JUEGO</button>
            ) : (
              <p className="text-lg text-amber-300/80 animate-pulse font-semibold">Esperando al anfitrión para empezar...</p>
            )}
          </div>
        )}

        {view === 'playing' && (
          <div className="w-full flex flex-col items-center">
             {role === 'host' ? (
               <Board categories={categories} onQuestionSelect={handleQuestionSelect}/>
             ) : (
               <div className="flex flex-col items-center justify-center h-full pt-16">
                  <div className="bg-slate-800/80 p-6 rounded-3xl mb-12 text-center border-t-4 border-amber-300 shadow-lg">
                     <h3 className="text-2xl font-bold text-sky-200 mb-2">Tu Puntaje Actual</h3>
                     <p className="text-5xl font-black text-amber-300" style={{ fontFamily: 'impact, sans-serif' }}>${myPlayer?.score || 0}</p>
                  </div>
                  {!activeQuestion && (
                    <p className="text-xl text-sky-200 animate-pulse mt-8">Esperando que el host elija una pregunta...</p>
                  )}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
