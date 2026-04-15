import React from 'react';
import Cell from './Cell';

const Board = ({ categories, onQuestionSelect }) => {
  const pointValues = [200, 400, 600, 800, 1000];

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 lg:p-8">
      {/* Grid container. For 6 categories, grid-cols-6 */}
      <div 
        className="grid gap-2 lg:gap-4 w-full"
        style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
      >
        {/* Render Category Headers */}
        {categories.map((cat, idx) => (
          <Cell 
            key={`header-${idx}`} 
            value={cat.name} 
            isCategory={true} 
          />
        ))}

        {/* Render Grid Items mapping rows -> cols */}
        {pointValues.map((points, rowIndex) => (
          <React.Fragment key={`row-${rowIndex}`}>
            {categories.map((cat, colIndex) => {
              // Encuentra la pregunta en la categoría que corresponde a este puntaje
              const question = cat.questions?.find(q => q.points === points);

              return (
                <Cell
                  key={`cell-${rowIndex}-${colIndex}`}
                  value={points}
                  // isAnswered if it's already solved or if question doesn't exist yet
                  isAnswered={question ? question.isAnswered : false}
                  onClick={() => {
                    if (question && !question.isAnswered) {
                       onQuestionSelect(cat, question);
                    }
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Board;