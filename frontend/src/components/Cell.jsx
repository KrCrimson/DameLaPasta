import React from 'react';

const Cell = ({ value, isCategory = false, isAnswered = false, onClick }) => {
  if (isCategory) {
    return (
      <div className="flex items-center justify-center p-4 bg-transparent text-indigo-100 font-black text-xl lg:text-2xl text-center uppercase h-24 mb-2 transition-all">
        <span className="drop-shadow-sm leading-tight" style={{ fontFamily: 'impact, sans-serif' }}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={isAnswered}
      className={`w-full h-20 lg:h-24 rounded-2xl border-4 border-sky-400 shadow-md shadow-sky-500/30 transition-all transform hover:-translate-y-1 active:scale-95 bg-slate-800/80 flex items-center justify-center m-1
        ${isAnswered ? 'opacity-20 cursor-not-allowed filter grayscale' : 'hover:bg-slate-700'}`}
    >
      {!isAnswered && (
        <span
          className="text-4xl lg:text-5xl font-black text-amber-300 drop-shadow-md"
          style={{ fontFamily: 'impact, sans-serif' }}
        >
          {value}
        </span>
      )}
    </button>
  );
};

export default Cell;