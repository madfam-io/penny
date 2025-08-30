import React, { useState } from 'react';

const MarkdownEditor = () => {
  const [content, setContent] = useState('');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full p-4 border rounded resize-none"
          placeholder="Enter markdown here..."
        />
      </div>
      <div className="flex-1 p-4 border-t">
        <div className="prose max-w-none">
          <p>Preview will appear here</p>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor;