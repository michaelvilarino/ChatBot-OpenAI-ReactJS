import React from 'react';

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

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewConversation: () => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversation,
  onSelect,
  onDelete,
  onNewConversation
}) => {
  return (
    <div className="conversation-list">
      <button onClick={onNewConversation} className="new-chat-btn">
        Nova Conversa
      </button>
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`conversation-item ${conversation.id === activeConversation ? 'active' : ''}`}
          onClick={() => onSelect(conversation.id)}
        >
          <div>
            <h3>{conversation.title}</h3>
            <p>{new Date(conversation.createdAt).toLocaleDateString()}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conversation.id);
            }}
            className="delete-btn"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
