import React, { useState, useEffect, useRef } from 'react';
import { OpenAI } from 'openai';
import ConversationList from './ConversationList';
import mammoth from 'mammoth';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Document {
  id: string;
  name: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  documents: Document[];
}

const Chat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStreamedMessage, setCurrentStreamedMessage] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
    dangerouslyAllowBrowser: true
  });

  useEffect(() => {
    const savedConversations = localStorage.getItem('conversations');
    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);
      setConversations(parsed);
      if (parsed.length > 0) {
        setActiveConversation(parsed[0].id);
      } else {
        createNewConversation();
      }
    } else {
      createNewConversation();
    }
  }, []);

  const saveToLocalStorage = (newConversations: Conversation[]): void => {
    localStorage.setItem('conversations', JSON.stringify(newConversations));
  };

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'Nova Conversa',
      messages: [],
      documents: [],
      createdAt: new Date()
    };
    const updatedConversations = [...conversations, newConversation];
    setConversations(updatedConversations);
    setActiveConversation(newConversation.id);
    saveToLocalStorage(updatedConversations);
  };

  const deleteConversation = (id: string) => {
    const updatedConversations = conversations.filter(conv => conv.id !== id);
    
    if (updatedConversations.length === 0) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: 'Nova Conversa',
        messages: [],
        documents: [],
        createdAt: new Date()
      };
      setConversations([newConversation]);
      setActiveConversation(newConversation.id);
      saveToLocalStorage([newConversation]);
    } else {
      setConversations(updatedConversations);
      if (activeConversation === id) {
        setActiveConversation(updatedConversations[0].id);
      }
      saveToLocalStorage(updatedConversations);
    }
  };

  const getCurrentConversation = () => {
    return conversations.find(conv => conv.id === activeConversation);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentStreamedMessage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
  
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        if (event.target?.result) {
          let text = '';
          
          if (file.name.endsWith('.docx')) {
            const arrayBuffer = event.target.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            text = result.value;
          } else {
            text = event.target.result as string;
          }

          console.log(text);
          
          const newDoc: Document = {
            id: Date.now().toString(),
            name: file.name,
            content: text
          };
          setDocuments(prev => [...prev, newDoc]);
        }
      };
  
      if (file.name.endsWith('.docx')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    }
  };
  
  

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!input.trim() || !activeConversation) return;
  
    const currentConversation = getCurrentConversation();
    if (!currentConversation) return;
  
    // Create document context string
    const documentContext = documents.length > 0 
      ? `${documents.map(doc => doc.content).join('\n\n')}`
      : '';
  
    const newUserMessage: Message = { 
      role: 'user', 
      content: input  // Only show user's input in chat
    };
  
    // Internal message for AI with full context
    const aiMessage = {
      role: 'user' as const,
      content: documentContext ? `${input}\n\n${documentContext}` : input
    };
  
    const updatedMessages = [...currentConversation.messages, newUserMessage];
  
    const updatedConversations = conversations.map(conv =>
      conv.id === activeConversation
        ? {
            ...conv,
            messages: updatedMessages,
            title: conv.messages.length === 0 
              ? (input.length > 30 ? input.slice(0, 30) + '...' : input)
              : conv.title
          }
        : conv
    );
  
    const newTitle = updatedConversations.find(c => c.id === activeConversation)?.title || 'Nova Conversa';
  
    setConversations(updatedConversations);
    saveToLocalStorage(updatedConversations);
    setInput('');
    setIsLoading(true);
    setCurrentStreamedMessage('');
  
    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system",
            content: "You are a helpful assistant. Analyze the provided documents and answer questions about them."
          },
          ...currentConversation.messages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          aiMessage
        ],
        stream: true,
      });
  
      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        setCurrentStreamedMessage(fullResponse);
      }
  
      const assistantMessage: Message = {
        role: 'assistant',
        content: fullResponse
      };
  
      const finalMessages = [...updatedMessages, assistantMessage];
      
      const finalConversations = conversations.map(conv =>
        conv.id === activeConversation
          ? { 
              ...conv, 
              messages: finalMessages,
              title: newTitle,
              documents: documents
            }
          : conv
      );
  
      setConversations(finalConversations);
      saveToLocalStorage(finalConversations);
      setCurrentStreamedMessage('');
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  

  return (
    <div className="chat-layout">
      <ConversationList
        conversations={conversations}
        activeConversation={activeConversation}
        onSelect={setActiveConversation}
        onDelete={deleteConversation}
        onNewConversation={createNewConversation}
      />
      <div className="chat-container">
        {documents.length > 0 && (
          <div className="document-list">
            <h4>Uploaded Documents:</h4>
            {documents.map(doc => (
              <div key={doc.id} className="document-item">
                <span>{doc.name}</span>
                <button 
                  onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))}
                  className="remove-doc-btn"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="messages">
          {getCurrentConversation()?.messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <strong>{message.role === 'user' ? 'You' : 'AI'}:</strong>
              <p>{message.content}</p>
            </div>
          ))}
          {currentStreamedMessage && (
            <div className="message assistant streaming">
              <strong>AI:</strong>
              <p>{currentStreamedMessage}</p>
            </div>
          )}
          {isLoading && !currentStreamedMessage && (
            <div className="loading">AI is thinking...</div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <label className="file-input-label">
            <input
              type="file"
              multiple
              accept=".txt,.doc,.docx,.pdf"
              onChange={handleFileUpload}
              className="file-input"
            />
            📎
          </label>
          <button type="submit" disabled={isLoading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
